
const express = require("express");
const router = express.Router();

const upload = require("../middlewares/upload");
const categoryCtrl = require('../controllers/categoryControllers')


router.post("/category/create", upload.single("image"), categoryCtrl.createCategory);
router.put("/category/update/:id", upload.single("image"), categoryCtrl.updateCategory);
router.patch("/category/toggle/:id", categoryCtrl.toggleCategoryStatus);
router.delete("/category/delete/:id", categoryCtrl.deleteCategory);


router.post("/subcategory/create", upload.single("image"), categoryCtrl.createSubCategory);
router.put("/subcategory/update/:id", upload.single("image"), categoryCtrl.updateSubCategory);
router.patch("/subcategory/toggle/:id", categoryCtrl.toggleSubCategoryStatus);
router.delete("/subcategory/delete/:id", categoryCtrl.deleteSubCategory);


router.post("/childcategory/create", upload.single("image"), categoryCtrl.createChildCategory);
router.put("/childcategory/update/:id", upload.single("image"), categoryCtrl.updateChildCategory);
router.patch("/childcategory/toggle/:id", categoryCtrl.toggleChildCategoryStatus);
router.delete("/childcategory/delete/:id", categoryCtrl.deleteChildCategory);


module.exports = router;