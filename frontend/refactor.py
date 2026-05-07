import os
import shutil
import glob
import re

SRC_DIR = "src"

def setup_directories():
    dirs = [
        "src/features/auth",
        "src/features/customer",
        "src/features/seller",
        "src/features/hitl",
        "src/features/admin",
        "src/shared/components",
        "src/shared/hooks",
        "src/services"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

def move_files():
    moves = [
        ("src/api.js", "src/services/api.js"),
        ("src/pages/LoginPage.jsx", "src/features/auth/LoginPage.jsx"),
    ]
    
    for src, dst in moves:
        if os.path.exists(src):
            shutil.move(src, dst)
            
    # Move customer pages
    for f in glob.glob("src/pages/customer/*.jsx"):
        shutil.move(f, f"src/features/customer/{os.path.basename(f)}")
        
    # Move seller pages
    for f in glob.glob("src/pages/Seller*.jsx"):
        shutil.move(f, f"src/features/seller/{os.path.basename(f)}")
        
    # Move hitl pages
    for f in glob.glob("src/pages/Hitl*.jsx"):
        shutil.move(f, f"src/features/hitl/{os.path.basename(f)}")
        
    # Move components
    for f in glob.glob("src/components/*.jsx"):
        shutil.move(f, f"src/shared/components/{os.path.basename(f)}")

def update_vite_config():
    vite_conf = "vite.config.js"
    if not os.path.exists(vite_conf):
        return
    with open(vite_conf, "r") as f:
        content = f.read()
    
    if "alias:" not in content:
        # insert alias
        content = content.replace("import react from '@vitejs/plugin-react'", "import react from '@vitejs/plugin-react'\nimport path from 'path'")
        
        alias_block = """
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
"""
        content = content.replace("plugins: [react()],", f"plugins: [react()],{alias_block}")
        
        with open(vite_conf, "w") as f:
            f.write(content)

def update_imports():
    for ext in ["**/*.jsx", "**/*.js"]:
        for file_path in glob.glob(f"src/{ext}", recursive=True):
            if not os.path.isfile(file_path): continue
            
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            original_content = content
            
            # Replace common relative imports with alias
            
            # api.js -> @/services/api
            content = re.sub(r"from\s+['\"](\.\.?\/)+api['\"]", "from '@/services/api'", content)
            
            # components -> @/shared/components
            content = re.sub(r"from\s+['\"](\.\.?\/)+components\/([^'\"]+)['\"]", r"from '@/shared/components/\2'", content)
            
            # App.jsx specific page imports
            if file_path.endswith("App.jsx"):
                content = re.sub(r"from\s+['\"](\.\/)?pages\/customer\/([^'\"]+)['\"]", r"from '@/features/customer/\2'", content)
                content = re.sub(r"from\s+['\"](\.\/)?pages\/(Seller[^'\"]+)['\"]", r"from '@/features/seller/\2'", content)
                content = re.sub(r"from\s+['\"](\.\/)?pages\/(Hitl[^'\"]+)['\"]", r"from '@/features/hitl/\2'", content)
                content = re.sub(r"from\s+['\"](\.\/)?pages\/(LoginPage)['\"]", r"from '@/features/auth/LoginPage'", content)
            
            # css imports
            content = re.sub(r"import\s+['\"](\.\.?\/)+customer\.css['\"]", "import '@/customer.css'", content)
            content = re.sub(r"import\s+['\"](\.\.?\/)+index\.css['\"]", "import '@/index.css'", content)

            if content != original_content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)

if __name__ == "__main__":
    setup_directories()
    move_files()
    update_vite_config()
    update_imports()
    print("Refactor complete.")
