const db = require("../db/db");

// Fetch all categories
exports.getAllCategories = async (req, res) => {
  try {
    const [categories] = await db.query("SELECT * FROM categories");
    res.status(200).json({ status: "success", categories: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching categories." });
  }
};

// Add new category
exports.addCategory = async (req, res) => {
  const { categoryName } = req.body;

  try {
    const result = await db.query("INSERT INTO categories (name) VALUES (?)", [
      categoryName,
    ]);
    res.status(201).json({ status: "success", categoryId: result.insertId });
  } catch (error) {
    console.error("Error adding category:", error);
    res
      .status(500)
      .send({ error: "An error occurred while adding a new category." });
  }
};

// Edit category name
exports.editCategoryName = async (req, res) => {
  const categoryId = req.params.categoryId;
  const { newName } = req.body;

  try {
    await db.query("UPDATE categories SET name = ? WHERE id = ?", [
      newName,
      categoryId,
    ]);
    res
      .status(200)
      .json({ status: "success", message: "Category name updated." });
  } catch (error) {
    console.error("Error updating category name:", error);
    res
      .status(500)
      .send({ error: "An error occurred while updating the category name." });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  const categoryId = req.params.categoryId;

  try {
    await db.query("DELETE FROM categories WHERE id = ?", [categoryId]);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting category:", error);
    res
      .status(500)
      .send({ error: "An error occurred while deleting the category." });
  }
};
