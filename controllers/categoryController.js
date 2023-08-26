const express = require("express");
const categoryModel = require("../models/CategoryModel");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const categories = await categoryModel.getAllCategories();
    res.status(200).json({ status: "success", categories: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching categories." });
  }
});

router.post("/", async (req, res) => {
  const { categoryName } = req.body;

  try {
    const categoryId = await categoryModel.addCategory(categoryName);
    res.status(201).json({ status: "success", categoryId: categoryId });
  } catch (error) {
    console.error("Error adding category:", error);
    res
      .status(500)
      .send({ error: "An error occurred while adding a new category." });
  }
});

router.put("/:categoryId", async (req, res) => {
  const categoryId = req.params.categoryId;
  const { newName } = req.body;

  try {
    await categoryModel.editCategoryName(categoryId, newName);
    res
      .status(200)
      .json({ status: "success", message: "Category name updated." });
  } catch (error) {
    console.error("Error updating category name:", error);
    res
      .status(500)
      .send({ error: "An error occurred while updating the category name." });
  }
});

router.delete("/:categoryId", async (req, res) => {
  const categoryId = req.params.categoryId;

  try {
    await categoryModel.deleteCategory(categoryId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting category:", error);
    res
      .status(500)
      .send({ error: "An error occurred while deleting the category." });
  }
});

module.exports = router;
