// ===============================
// GLOBAL CART JS
// ===============================

document.addEventListener("DOMContentLoaded", () => {
    loadCart();
});

// -------------------------------
// 1. GET CART ITEMS
// -------------------------------
async function loadCart() {
    try {
        const res = await fetch("/listCart");
        const data = await res.json();

        if (!data.success) return;

        renderCartItems(data.cart.items);
        updateCartTotal(data.cart.items);
        updateCartCount(data.cart.items);  

    } catch (err) {
        console.error("LOAD CART ERROR:", err);
    }
}


// -------------------------------
// 2. RENDER CART INTO MINI CART
// -------------------------------
function renderCartItems(items) {
    const container = document.querySelector(".tf-mini-cart-items");
    if (!container) return;

    container.innerHTML = "";

    if (items.length === 0) {
        container.innerHTML = `<p class="text-center text-muted">Your cart is empty</p>`;
        return;
    }

    items.forEach(item => {
        container.innerHTML += `
            <div class="tf-mini-cart-item" data-id="${item._id}">
                <div class="tf-mini-cart-image">
                    <img src="${item.productId?.images?.[0] || '/images/no-image.png'}" alt="">
                </div>

                <div class="tf-mini-cart-info flex-grow-1">
                    <div class="mb_12 d-flex justify-content-between">
                        <div class="text-title">
                            ${item.productId?.title || "Product"}
                            ${item.optionValue ? `<small class="text-muted">(${item.optionValue})</small>` : ""}
                        </div>
                        <div class="text-button tf-btn-remove" onclick="removeCartItem('${item._id}')">Remove</div>
                    </div>

                    <div class="d-flex align-items-center justify-content-between">
                        <div class="text-button">
                            ${item.quantity} x ₹${item.price}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

// -------------------------------
// 3. ADD TO CART
// -------------------------------
async function addToCart(productId, variantId = null, optionId = null, quantity = 1) {
    try {
        const res = await fetch("/addCart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, variantId, optionId, quantity })
        });

        const data = await res.json();

        if (data.success) {
            loadCart(); // reload cart UI
            openCartModal();
        } else {
            alert(data.message);
        }

    } catch (err) {
        console.error("ADD CART ERROR:", err);
    }
}

// -------------------------------
// 4. UPDATE CART QUANTITY
// -------------------------------
async function updateCartQty(itemId, qty) {
    try {
        const res = await fetch("/updateCart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, quantity: qty })
        });

        const data = await res.json();
        if (data.success) {
            loadCart();
        }
    } catch (err) {
        console.error("UPDATE QTY ERROR:", err);
    }
}

// -------------------------------
// 5. REMOVE CART ITEM
// -------------------------------
async function removeCartItem(itemId) {
    try {
        const res = await fetch(`/removeCart/${itemId}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            loadCart();
        }
    } catch (err) {
        console.error("REMOVE ERROR:", err);
    }
}

// -------------------------------
// 6. CLEAR CART
// -------------------------------
async function clearCart() {
    try {
        const res = await fetch("/clearCart", { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            loadCart();
        }
    } catch (err) {
        console.error("CLEAR CART ERROR:", err);
    }
}

// -------------------------------
// 7. UPDATE TOTAL
// -------------------------------
function updateCartTotal(items) {
    const totalEl = document.querySelector(".tf-totals-total-value");
    if (!totalEl) return;

    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    totalEl.textContent = `₹${total.toFixed(2)}`;
}

// -------------------------------
// 8. OPEN MINI CART MODAL
// -------------------------------
function openCartModal() {
    const modalEl = document.getElementById("shoppingCart");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function updateCartCount(items) {
    const countEl = document.querySelector(".nav-cart .count-box");
    if (!countEl) return;

    const totalQty = items.reduce((acc, item) => acc + item.quantity, 0);
    countEl.textContent = totalQty;
}