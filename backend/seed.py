"""
Seed script: runs schema_v3.sql against the database.

Usage:
    cd backend
    python seed.py
"""

import asyncio
import os
import sys

import asyncpg
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def main():
    database_url = os.environ.get("DATABASE_URL", "")
    # Convert SQLAlchemy async URL to plain PostgreSQL URL for asyncpg
    pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    schema_path = os.path.join(os.path.dirname(__file__), "..", "schema_v3.sql")
    if not os.path.exists(schema_path):
        print(f"Schema file not found: {schema_path}")
        sys.exit(1)

    with open(schema_path, "r") as f:
        schema_sql = f.read()

    print(f"Connecting to {pg_url.split('@')[-1]}...")
    conn = await asyncpg.connect(pg_url)

    try:
        print("Running schema_v3.sql...")
        # asyncpg requires using execute() for each statement individually,
        # but supports multi-statement scripts via the lower-level protocol
        # when wrapped in a transaction. Use the simple query protocol instead.
        await conn.execute("BEGIN")
        # Split on semicolons, filtering out empty statements and comments
        statements = []
        current = []
        in_function = False
        for line in schema_sql.split("\n"):
            stripped = line.strip()
            # Track $$ function bodies
            if "$$" in line:
                in_function = not in_function
            current.append(line)
            if stripped.endswith(";") and not in_function:
                stmt = "\n".join(current).strip()
                if stmt and not stmt.startswith("--"):
                    statements.append(stmt)
                current = []

        # Handle any remaining content
        if current:
            stmt = "\n".join(current).strip()
            if stmt and not stmt.startswith("--"):
                statements.append(stmt)

        for i, stmt in enumerate(statements):
            # Skip empty statements
            if not stmt or stmt == ";":
                continue
            try:
                await conn.execute(stmt)
            except asyncpg.exceptions.DuplicateTableError:
                pass  # Table already exists, skip
            except asyncpg.exceptions.DuplicateObjectError:
                pass  # Extension/type already exists, skip
            except Exception as e:
                print(f"Warning on statement {i + 1}: {e}")
                print(f"  Statement: {stmt[:100]}...")

        await conn.execute("COMMIT")
        print("Schema applied successfully.")
    except Exception as e:
        await conn.execute("ROLLBACK")
        print(f"Error applying schema: {e}")
        sys.exit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
