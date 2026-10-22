require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./db");

async function main() {
  const [name, email, password, role] = process.argv.slice(2);

  if (
    !name ||
    !email ||
    !password ||
    !["Field Worker", "Administrator"].includes(role)
  ) {
    throw new Error(
      'Usage: node create-user.js "Name" "email" "password" "Administrator|Field Worker"'
    );
  }

  if (password.length < 12) {
    throw new Error("Use a password of at least 12 characters");
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1,$2,$3,$4)`,
    [name, email.toLowerCase(), hash, role]
  );

  console.log("User created successfully");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());