const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { getFinalPrice } = require("../utils/cartPrice");

exports.addToCart = async (req, res) => {
    console.log("Add to cart request body:", req.body);

    try {
        const userId = req.session.user.id;
        const { productId, variantId, optionId, variantSelections = [], quantity = 1 } = req.body;

        console.log("Product ID:", productId);
        console.log("Variant ID:", variantId);
        console.log("Option ID:", optionId);
        console.log("Variant Selections:", variantSelections);

        const product = await Product.findById(productId).lean();
        if (!product) {
            console.log("Product not found for ID:", productId);
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        let selectedVariantId = null;
        let selectedOptionId = null;
        let variantName = null;
        let optionValue = null;
        let finalPrice = product.salePrice || product.basePrice;

        // Handle both old format (variantId, optionId) and new format (variantSelections)
        if (variantId && optionId) {
            // Old format - single variant selection
            selectedVariantId = variantId;
            selectedOptionId = optionId;

            if (product.variants && product.variants.length > 0) {
                for (const variant of product.variants) {
                    if (variant._id.toString() === variantId) {
                        variantName = variant.name;
                        const option = variant.options.find(o => o._id.toString() === optionId);
                        if (option) {
                            optionValue = option.value;
                            finalPrice = option.adminSalePrice || option.salePrice || option.price || finalPrice;
                        }
                        break;
                    }
                }
            }
        } else if (variantSelections.length > 0) {
            // New format - multiple variant selections
            const selections = [];

            for (const selection of variantSelections) {
                const variant = product.variants?.find(v => v._id.toString() === selection.variantId);
                if (!variant) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid variant: ${selection.variantName}`
                    });
                }

                const option = variant.options?.find(o => o._id.toString() === selection.optionId);
                if (!option) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid option for ${variant.name}`
                    });
                }

                if (option.stock !== undefined && option.stock <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: `${option.value} is out of stock`
                    });
                }

                selections.push({
                    variantId: selection.variantId,
                    optionId: selection.optionId,
                    variantName: variant.name,
                    optionValue: option.value
                });

                // Use first variant's price
                if (!selectedVariantId) {
                    selectedVariantId = selection.variantId;
                    selectedOptionId = selection.optionId;
                    variantName = variant.name;
                    optionValue = option.value;
                    finalPrice = option.adminSalePrice || option.salePrice || option.price || finalPrice;
                }
            }
        }

        // Load or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = await Cart.create({ userId, items: [] });
        }

        // Check if existing item exists with same variant combination
        let existingItem = null;

        if (selectedVariantId && selectedOptionId) {
            // For variant products
            existingItem = cart.items.find(item =>
                item.productId.toString() === productId &&
                item.optionId === selectedOptionId
            );
        } else {
            // For non-variant products
            existingItem = cart.items.find(item =>
                item.productId.toString() === productId &&
                !item.optionId
            );
        }

        if (existingItem) {
            existingItem.quantity += Number(quantity);
        } else {
            cart.items.push({
                productId,
                variantName,
                optionValue,
                optionId: selectedOptionId,
                variantId: selectedVariantId,
                quantity: Number(quantity),
                price: finalPrice
            });
        }

        await cart.save();

        return res.json({
            success: true,
            message: "Added to cart",
            cart,
            cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        });

    } catch (err) {
        console.log("ADD CART ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};


exports.getCart = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const cart = await Cart.findOne({ userId })
            .populate("items.productId", "title images basePrice salePrice adminBasePrice adminSalePrice variants")
            .lean();

        return res.json({
            success: true,
            cart: cart || { userId, items: [] }
        });

    } catch (err) {
        console.log("GET CART ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateCartQty = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { itemId, quantity } = req.body;

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        const item = cart.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: "Item not found" });

        item.quantity = quantity;

        await cart.save();

        return res.json({ success: true, cart });

    } catch (err) {
        console.log("UPDATE CART ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.removeCartItem = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { itemId } = req.params;

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        await cart.save();

        return res.json({ success: true, message: "Item removed", cart });

    } catch (err) {
        console.log("REMOVE CART ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.clearCart = async (req, res) => {
    try {
        const userId = req.session.user.id;
        await Cart.findOneAndUpdate({ userId }, { items: [] });

        return res.json({ success: true, message: "Cart cleared" });

    } catch (err) {
        console.log("CLEAR CART ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};


exports.guestAddToCart = async (req, res) => {
    try {
        const { productId, variantSelections = [], quantity = 1 } = req.body;

        // Store in session for after login
        if (!req.session.guestCart) {
            req.session.guestCart = [];
        }

        // Add item to guest cart
        const cartItem = {
            productId,
            variantSelections,
            quantity,
            addedAt: new Date()
        };

        req.session.guestCart.push(cartItem);

        return res.json({
            success: true,
            message: "Item added to guest cart. Please login to complete.",
            requiresLogin: true
        });
    } catch (err) {
        console.log("GUEST CART ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};