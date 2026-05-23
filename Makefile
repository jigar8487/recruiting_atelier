.PHONY: install dev backend mcp frontend test acceptance clean

install:
	cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install

dev:
	npx --yes concurrently -n api,mcp,web -c blue,magenta,green \
	  "cd backend && . .venv/bin/activate && uvicorn api.app:create_app --factory --reload --port 1812" \
	  "cd backend && . .venv/bin/activate && python -m mcp.server" \
	  "cd frontend && npm run dev"

backend:
	cd backend && . .venv/bin/activate && uvicorn api.app:create_app --factory --reload --port 1812

mcp:
	cd backend && . .venv/bin/activate && python -m mcp.server

frontend:
	cd frontend && npm run dev

test:
	cd backend && . .venv/bin/activate && pytest -v

acceptance:
	cd backend && . .venv/bin/activate && pytest tests/integration/test_canonical_run.py -v

clean:
	rm -rf backend/.venv backend/__pycache__ backend/**/__pycache__
	rm -rf frontend/node_modules frontend/.next
	rm -rf .chroma-shortlists .chroma
