from fastapi import FastAPI

app = FastAPI(title="Intelligent Event Management System")

@app.get("/")
def root():
    return {"message": "IEM API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}
