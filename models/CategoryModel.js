const db = require("../db/db");

exports.getAllCategories = async () => {
  try {
    const [categories] = await db.query("SELECT * FROM categories");
    return categories;
  } catch (error) {
    throw new Error("Error fetching categories");
  }
};

exports.addCategory = async (categoryName) => {
  try {
    const result = await db.query("INSERT INTO categories (name) VALUES (?)", [
      categoryName,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error("Error adding category");
  }
};

exports.editCategoryName = async (categoryId, newName) => {
  try {
    await db.query("UPDATE categories SET name = ? WHERE id = ?", [
      newName,
      categoryId,
    ]);
  } catch (error) {
    throw new Error("Error updating category name");
  }
};

exports.deleteCategory = async (categoryId) => {
  try {
    await db.query("DELETE FROM categories WHERE id = ?", [categoryId]);
  } catch (error) {
    throw new Error("Error deleting category");
  }
};
