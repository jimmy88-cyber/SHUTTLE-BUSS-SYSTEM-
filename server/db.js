const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
};

async function getConnection() {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error("Oracle Connection Error:", error);
    throw error;
  }
}

async function generateEmpId(connection) {
  const currentYear = new Date().getFullYear();
  const buddhistYear = currentYear + 543;
  const yearCode = String(buddhistYear).slice(-2);
  const result = await connection.execute(
    `SELECT MAX(EMPID) AS MAXID
      FROM MUTEMP
      WHERE EMPID LIKE :prefix`,
    { prefix: `EMP${yearCode}%` },
  );
  let runningNumber = 1;
  if (result.rows[0][0]) {
    const maxId = result.rows[0][0];
    const lastNumber = parseInt(maxId.substring(5), 10);
    runningNumber = lastNumber + 1;
  }
  const runningCode = String(runningNumber).padStart(3, "0");
  return `EMP${yearCode}${runningCode}`;
}

// =====================================================
// LOGIN API
// =====================================================
app.post("/api/login", async (req, res) => {
  let connection;
  try {
    const { empemail, emppassword } = req.body;
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT EMPID, EMPNAME, EMPEMAIL, EMPPASSWORD, PERMISSION
       FROM MUTEMP
       WHERE EMPEMAIL = :empemail`,
      { empemail },
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    const row = result.rows[0];
    const isMatch = await bcrypt.compare(emppassword, row[3]);

    if (!isMatch) {
      return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    res.json({
      message: "Login successful",
      user: {
        empId: row[0],
        empname: row[1],
        empemail: row[2],
        permission: row[4] || "0000",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// GET ALL EMPLOYEES
// =====================================================
app.get("/api/mutemp", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT EMPID, EMPNAME, EMPADDRESS, EMPEMAIL, SALARY, PERMISSION
      FROM MUTEMP
      ORDER BY EMPID`,
    );
    const employees = result.rows.map((row) => ({
      empId: row[0],
      empname: row[1],
      empaddress: row[2],
      empemail: row[3],
      salary: row[4],
      permission: row[5] || "0000",
    }));

    res.json(employees);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Cannot get employees", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// CREATE EMPLOYEE
// =====================================================
app.post("/api/mutemp", async (req, res) => {
  let connection;
  try {
    const { empname, empaddress, empemail, emppassword, salary, permission } =
      req.body;
    if (!emppassword || emppassword.trim() === "") {
      return res.status(400).json({ message: "Password is required" });
    }
    connection = await getConnection();
    const empId = await generateEmpId(connection);
    const hashedPassword = await bcrypt.hash(emppassword, 10);
    const permCode = permission || "0000";

    await connection.execute(
      `INSERT INTO MUTEMP(EMPID, EMPNAME, EMPADDRESS, EMPEMAIL, EMPPASSWORD, SALARY, PERMISSION)
       VALUES(:empId, :empname, :empaddress, :empemail, :emppassword, :salary, :permission)`,
      {
        empId,
        empname,
        empaddress,
        empemail,
        emppassword: hashedPassword,
        salary,
        permission: permCode,
      },
      { autoCommit: true },
    );

    res.status(201).json({ message: "Employee created successfully", empId });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Cannot create employee", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// UPDATE EMPLOYEE
// =====================================================
app.put("/api/mutemp/:id", async (req, res) => {
  let connection;
  try {
    const empId = req.params.id;
    const { empname, empaddress, empemail, emppassword, salary, permission } =
      req.body;
    connection = await getConnection();
    const permCode = permission || "0000";

    if (emppassword && emppassword.trim() !== "") {
      const hashedPassword = await bcrypt.hash(emppassword, 10);
      await connection.execute(
        `UPDATE MUTEMP SET
        EMPNAME = :empname,
        EMPADDRESS = :empaddress,
        EMPEMAIL = :empemail,
        EMPPASSWORD = :emppassword,
        SALARY = :salary,
        PERMISSION = :permission
        WHERE EMPID = :empId`,
        {
          empId,
          empname,
          empaddress,
          empemail,
          emppassword: hashedPassword,
          salary,
          permission: permCode,
        },
        { autoCommit: true },
      );
    } else {
      await connection.execute(
        `UPDATE MUTEMP SET
        EMPNAME = :empname,
        EMPADDRESS = :empaddress,
        EMPEMAIL = :empemail,
        SALARY = :salary,
        PERMISSION = :permission
        WHERE EMPID = :empId`,
        {
          empId,
          empname,
          empaddress,
          empemail,
          salary,
          permission: permCode,
        },
        { autoCommit: true },
      );
    }
    res.json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Cannot update employee", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// DELETE EMPLOYEE
// =====================================================
app.delete("/api/mutemp/:id", async (req, res) => {
  let connection;
  try {
    const empId = req.params.id;
    connection = await getConnection();
    await connection.execute(
      `DELETE FROM MUTEMP WHERE EMPID = :empId`,
      { empId },
      { autoCommit: true },
    );
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Cannot delete employee", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

//---------------------- customer ------------------------//

app.get("/api/mutcus", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT *
      FROM MUTCUSTOMER
      ORDER BY CUSID`,
    );
    const employees = result.rows.map((row) => ({
      cusId: row[0],
      cusname: row[1],
      cusaddress: row[2],
      custel: row[3],
      cusemail: row[4],
    }));

    res.json(employees);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Cannot get customer", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

//----------------------product--------------------------//

// เปิดให้เข้าถึงโฟลเดอร์รูปภาพ static
app.use("/img", express.static(path.join(__dirname, "img")));

// สร้างโฟลเดอร์ img อัตโนมัติถ้ายังไม่มี
const imgDir = path.join(__dirname, "img");
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir);
}

// ตั้งค่า Storage สำหรับ Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "img/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "PROD-" + uniqueSuffix + ext);
  },
});
const upload = multer({ storage: storage });

// =====================================================
// GENERATE PRODUCT ID (P0001, P0002, ...)
// =====================================================
async function generateProId(connection) {
  const result = await connection.execute(
    `SELECT MAX(PROID) AS MAXID FROM MUTPRODUCT WHERE PROID LIKE 'P%'`,
  );
  let runningNumber = 1;
  if (result.rows[0][0]) {
    const maxId = result.rows[0][0]; // ตัวอย่าง P0001
    const lastNumber = parseInt(maxId.substring(1), 10);
    runningNumber = lastNumber + 1;
  }
  return `P${String(runningNumber).padStart(4, "0")}`;
}

// =====================================================
// GET ALL PRODUCTS
// =====================================================
app.get("/api/mutproduct", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT PROID, PRONAME, IMG, DETAIL, PRICE FROM MUTPRODUCT ORDER BY PROID`,
    );
    const products = result.rows.map((row) => ({
      proId: row[0],
      proName: row[1],
      img: row[2],
      detail: row[3],
      price: row[4],
    }));
    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cannot get products", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// CREATE PRODUCT (พร้อมอัปโหลดรูป)
// =====================================================
app.post("/api/mutproduct", upload.single("img"), async (req, res) => {
  let connection;
  try {
    const { proName, detail, price } = req.body;
    const imgFilename = req.file ? req.file.filename : "";

    connection = await getConnection();
    const proId = await generateProId(connection);

    await connection.execute(
      `INSERT INTO MUTPRODUCT(PROID, PRONAME, IMG, DETAIL, PRICE)
       VALUES(:proId, :proName, :img, :detail, :price)`,
      {
        proId,
        proName,
        img: imgFilename,
        detail: detail || "",
        price: parseFloat(price) || 0,
      },
      { autoCommit: true },
    );

    res.status(201).json({ message: "Product created successfully", proId });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cannot create product", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// UPDATE PRODUCT
// =====================================================
app.put("/api/mutproduct/:id", upload.single("img"), async (req, res) => {
  let connection;
  try {
    const proId = req.params.id;
    const { proName, detail, price } = req.body;
    connection = await getConnection();

    if (req.file) {
      // มีการอัปโหลดรูปใหม่
      const imgFilename = req.file.filename;
      await connection.execute(
        `UPDATE MUTPRODUCT SET
         PRONAME = :proName,
         IMG = :img,
         DETAIL = :detail,
         PRICE = :price
         WHERE PROID = :proId`,
        {
          proId,
          proName,
          img: imgFilename,
          detail,
          price: parseFloat(price) || 0,
        },
        { autoCommit: true },
      );
    } else {
      // ไม่ได้เปลี่ยนรูปใหม่
      await connection.execute(
        `UPDATE MUTPRODUCT SET
         PRONAME = :proName,
         DETAIL = :detail,
         PRICE = :price
         WHERE PROID = :proId`,
        { proId, proName, detail, price: parseFloat(price) || 0 },
        { autoCommit: true },
      );
    }

    res.json({ message: "Product updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cannot update product", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================================================
// DELETE PRODUCT
// =====================================================
app.delete("/api/mutproduct/:id", async (req, res) => {
  let connection;
  try {
    const proId = req.params.id;
    connection = await getConnection();

    await connection.execute(
      `DELETE FROM MUTPRODUCT WHERE PROID = :proId`,
      { proId },
      { autoCommit: true },
    );

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cannot delete product", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

//--------------------------------------------------------//

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});