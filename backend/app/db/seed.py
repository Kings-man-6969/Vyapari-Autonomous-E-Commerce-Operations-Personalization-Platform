from __future__ import annotations

from app.db.database import AgentSetting, Product, create_schema, db_session


SAMPLE_PRODUCTS = [
    {
        "id": "P001",
        "name": "Noise Cancelling Headphones",
        "category": "Electronics",
        "price": 4999.0,
        "cost": 3200.0,
        "stock": 28,
        "description": "Wireless over-ear headphones with active noise cancellation.",
    },
    {
        "id": "P002",
        "name": "Stainless Steel Water Bottle",
        "category": "Sports",
        "price": 799.0,
        "cost": 420.0,
        "stock": 12,
        "description": "Insulated 1L bottle suitable for gym and travel.",
    },
    {
        "id": "P003",
        "name": "Cotton Casual Shirt",
        "category": "Clothing",
        "price": 1199.0,
        "cost": 700.0,
        "stock": 6,
        "description": "Breathable slim-fit shirt for daily wear.",
    },
    {
        "id": "P004",
        "name": "Non-Stick Cookware Set",
        "category": "Home & Kitchen",
        "price": 3499.0,
        "cost": 2200.0,
        "stock": 3,
        "description": "5-piece cookware set with induction-compatible base.",
    },
    {
        "id": "P005",
        "name": "Productivity Planner",
        "category": "Books",
        "price": 499.0,
        "cost": 180.0,
        "stock": 41,
        "description": "Undated weekly planner for goals and habit tracking.",
    },
]


def seed_data() -> None:
    create_schema()
    with db_session() as session:
        if session.query(Product).count() == 0:
            session.add_all(Product(**product) for product in SAMPLE_PRODUCTS)

        if session.query(AgentSetting).count() == 0:
            session.add(AgentSetting(id=1))
