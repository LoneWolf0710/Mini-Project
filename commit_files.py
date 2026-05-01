import os
import subprocess
import time

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

# Create branch
run_cmd('git checkout -b hardware-codes')

# Get untracked files
untracked = run_cmd('git ls-files --others --exclude-standard').split('\n')

for file in untracked:
    if file:
        print(f"Adding and committing {file}...")
        run_cmd(f'git add "{file}"')
        
        # Determine a commit message
        if "dashboard" in file:
            msg = f"feat(dashboard): add {os.path.basename(file)} for frontend interface"
        elif "modules" in file:
            msg = f"feat(modules): implement {os.path.basename(file)} hardware integration"
        elif "config" in file:
            msg = f"chore: update configuration in {os.path.basename(file)}"
        else:
            msg = f"chore: add {os.path.basename(file)}"
            
        run_cmd(f'git commit -m "{msg}"')
        time.sleep(0.5)

print("Finished committing all files individually.")
