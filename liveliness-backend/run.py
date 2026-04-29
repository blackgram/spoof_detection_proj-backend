#!/usr/bin/env python3
"""Run the liveliness API (default port 8001 to avoid clashing with monolith on 8000)."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
    )
