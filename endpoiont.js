// // ================================================
// // POSTMAN RAW REQUESTS - CART & ORDER ENDPOINTS
// // ================================================

// // BASE URL
// // http://localhost:5000/api

// // ================================================
// // 1. ADD ITEM TO CART (POST)
// // ================================================

// POST http://localhost:5000/api/cart/add
// Content-Type: application/json
// Authorization: Bearer YOUR_TOKEN_HERE

// {
//   "productId": "66a1b2c3d4e5f6g7h8i9j0k1",
//   "quantity": 2
// }

// ---

// // ================================================
// // 2. GET USER CART (GET)
// // ================================================

// GET http://localhost:5000/api/cart
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 3. UPDATE CART ITEM QUANTITY (PATCH)
// // ================================================

// PATCH http://localhost:5000/api/cart/update/66a1b2c3d4e5f6g7h8i9j0k1
// Content-Type: application/json
// Authorization: Bearer YOUR_TOKEN_HERE

// {
//   "quantity": 5
// }

// ---

// // ================================================
// // 4. REMOVE ITEM FROM CART (DELETE)
// // ================================================

// DELETE http://localhost:5000/api/cart/remove/66a1b2c3d4e5f6g7h8i9j0k1
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 5. GET CART SUMMARY (GET)
// // ================================================

// GET http://localhost:5000/api/cart/summary
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 6. CLEAR ENTIRE CART (DELETE)
// // ================================================

// DELETE http://localhost:5000/api/cart/clear
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 7. VERIFY PAYMENT & CREATE ORDER (POST)
// // ================================================

// POST http://localhost:5000/api/orders/verify-payment
// Content-Type: application/json
// Authorization: Bearer YOUR_TOKEN_HERE

// {
//   "reference": "paystack-ref-1234567890",
//   "orderId": "ORD-1234567890-5678",
//   "shippingInfo": {
//     "fullName": "John Doe",
//     "email": "john@example.com",
//     "phone": "+234 801 234 5678",
//     "address": "123 Main Street",
//     "city": "Lagos",
//     "state": "Lagos",
//     "zipCode": "100001"
//   },
//   "items": [
//     {
//       "_id": "66a1b2c3d4e5f6g7h8i9j0k1",
//       "productId": "66a1b2c3d4e5f6g7h8i9j0k1",
//       "name": "iPhone 15 Pro",
//       "price": 999,
//       "quantity": 1,
//       "images": [
//         "https://example.com/image1.jpg"
//       ]
//     },
//     {
//       "_id": "66a1b2c3d4e5f6g7h8i9j0k2",
//       "productId": "66a1b2c3d4e5f6g7h8i9j0k2",
//       "name": "Apple Watch",
//       "price": 399,
//       "quantity": 2,
//       "images": [
//         "https://example.com/image2.jpg"
//       ]
//     }
//   ],
//   "subtotal": 1797,
//   "shipping": 10,
//   "tax": 179.7,
//   "total": 1986.7,
//   "orderNote": "Please handle with care. It's a gift!"
// }

// ---

// // ================================================
// // 8. GET USER'S ORDERS (GET)
// // ================================================

// GET http://localhost:5000/api/orders?page=1&limit=10&status=processing
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 9. GET SINGLE ORDER (GET)
// // ================================================

// GET http://localhost:5000/api/orders/66a1b2c3d4e5f6g7h8i9j0k1
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 10. CANCEL ORDER (POST)
// // ================================================

// POST http://localhost:5000/api/orders/66a1b2c3d4e5f6g7h8i9j0k1/cancel
// Content-Type: application/json
// Authorization: Bearer YOUR_TOKEN_HERE

// {
//   "reason": "Changed my mind about this purchase"
// }

// ---

// // ================================================
// // 11. UPDATE ORDER STATUS (PATCH) - ADMIN ONLY
// // ================================================

// PATCH http://localhost:5000/api/orders/66a1b2c3d4e5f6g7h8i9j0k1/status
// Content-Type: application/json
// Authorization: Bearer ADMIN_TOKEN_HERE

// {
//   "status": "shipped"
// }

// ---

// // ================================================
// // 12. UPDATE DELIVERY INFO (PATCH) - ADMIN ONLY
// // ================================================

// PATCH http://localhost:5000/api/orders/66a1b2c3d4e5f6g7h8i9j0k1/delivery
// Content-Type: application/json
// Authorization: Bearer ADMIN_TOKEN_HERE

// {
//   "trackingNumber": "TRACK123456789",
//   "estimatedDelivery": "2024-12-28T10:00:00Z",
//   "deliveredAt": null
// }

// ---

// // ================================================
// // 13. ADD NOTE TO ORDER (POST) - ADMIN ONLY
// // ================================================

// POST http://localhost:5000/api/orders/66a1b2c3d4e5f6g7h8i9j0k1/notes
// Content-Type: application/json
// Authorization: Bearer ADMIN_TOKEN_HERE

// {
//   "message": "Package has been handed over to courier service"
// }

// ---

// // ================================================
// // 14. GET ORDERS BY STATUS (GET) - ADMIN ONLY
// // ================================================

// GET http://localhost:5000/api/orders/filter/status/shipped?page=1&limit=10
// Authorization: Bearer ADMIN_TOKEN_HERE

// ---

// // ================================================
// // 15. GET ORDER STATISTICS - USER
// // ================================================

// GET http://localhost:5000/api/orders/stats/user
// Authorization: Bearer YOUR_TOKEN_HERE

// ---

// // ================================================
// // 16. GET ORDER STATISTICS - ADMIN
// // ================================================

// GET http://localhost:5000/api/orders/stats/admin
// Authorization: Bearer ADMIN_TOKEN_HERE

// ---

// // ================================================
// // COMPLETE WORKFLOW EXAMPLE
// // ================================================

// // Step 1: Add product to cart
// POST http://localhost:5000/api/cart/add
// {
//   "productId": "66a1b2c3d4e5f6g7h8i9j0k1",
//   "quantity": 1
// }

// // Step 2: Get cart
// GET http://localhost:5000/api/cart

// // Step 3: Get cart summary (pricing breakdown)
// GET http://localhost:5000/api/cart/summary

// // Step 4: Verify payment with Paystack and create order
// POST http://localhost:5000/api/orders/verify-payment
// {
//   "reference": "paystack-ref-from-frontend",
//   "orderId": "ORD-1234567890-5678",
//   "shippingInfo": { ... },
//   "items": [ ... ],
//   "subtotal": 1000,
//   "shipping": 10,
//   "tax": 100,
//   "total": 1110,
//   "orderNote": "..."
// }

// // Step 5: Get order details
// GET http://localhost:5000/api/orders/order-id-from-response

// // Step 6 (ADMIN): Update order status to shipped
// PATCH http://localhost:5000/api/orders/order-id-from-response/status
// {
//   "status": "shipped"
// }

// // Step 7 (ADMIN): Add delivery tracking
// PATCH http://localhost:5000/api/orders/order-id-from-response/delivery
// {
//   "trackingNumber": "TRACKING123",
//   "estimatedDelivery": "2024-12-28T10:00:00Z"
// }

// ---

// // ================================================
// // ENVIRONMENT VARIABLES (For Postman)
// // ================================================

// {
//   "base_url": "http://localhost:5000/api",
//   "token": "YOUR_JWT_TOKEN_HERE",
//   "admin_token": "ADMIN_JWT_TOKEN_HERE",
//   "product_id_1": "66a1b2c3d4e5f6g7h8i9j0k1",
//   "product_id_2": "66a1b2c3d4e5f6g7h8i9j0k2",
//   "order_id": "66a1b2c3d4e5f6g7h8i9j0k3"
// }

// ---

// // ================================================
// // NOTES
// // ================================================

// /*
// 1. Replace YOUR_TOKEN_HERE with actual JWT token from login
// 2. Replace ADMIN_TOKEN_HERE with admin JWT token
// 3. Replace product IDs with real product IDs from your database
// 4. For Paystack reference, use real Paystack transaction reference
// 5. Order IDs are returned after successful order creation
// 6. Status values: processing, shipped, delivered, cancelled, returned
// 7. All requests require Authorization header with Bearer token
// 8. Admin requests need admin role in the JWT token
// */
