import os
import boto3
from flask import Flask, request, redirect, render_template, session, jsonify

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB
app.secret_key = 'mysecret123'

# AWS S3 setup
s3 = boto3.client(
    's3',
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_KEY"),
    region_name='ap-south-1'
)

BUCKET_NAME = 'awss3-my-cloud-2026'

# -------------------------------
# ROUTES
# -------------------------------

# Home → Always login first
@app.route('/')
def home():
    if 'user' in session:
        return redirect('/dashboard')
    return render_template('login.html')


# Login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if username == 'admin' and password == '1234':
            session['user'] = username
            return redirect('/dashboard')
        else:
            return "Invalid credentials"

    return render_template('login.html')


# Dashboard
@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect('/login')
    return render_template('index.html')


# Logout (optional but useful)
@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')


# Upload file
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'user' not in session:
        return redirect('/login')

    file = request.files.get('file')
    if not file:
        return "No file selected"

    s3.upload_fileobj(file, BUCKET_NAME, file.filename)
    return "File uploaded successfully!"


# List files
@app.route('/files', methods=['GET'])
def list_files():
    if 'user' not in session:
        return redirect('/login')

    response = s3.list_objects_v2(Bucket=BUCKET_NAME)

    files = []
    total_size = 0

    if 'Contents' in response:
        for obj in response['Contents']:
            filename = obj['Key']

            if filename.startswith("trash/"):
                continue

            size_kb = round(obj['Size'] / 1024, 2)
            total_size += obj['Size']

            ext = filename.split('.')[-1].lower()

            if ext in ['jpg', 'png', 'jpeg']:
                file_type = 'image'
            elif ext in ['mp4', 'avi']:
                file_type = 'video'
            elif ext in ['mp3', 'wav']:
                file_type = 'audio'
            else:
                file_type = 'other'

            files.append({
                "name": filename,
                "size": size_kb,
                "type": file_type
            })

    total_storage_mb = round(total_size / (1024 * 1024), 2)

    return jsonify({
        "files": files,
        "total_storage_mb": total_storage_mb
    })


# Trash files
@app.route('/trash', methods=['GET'])
def get_trash():
    if 'user' not in session:
        return redirect('/login')

    response = s3.list_objects_v2(Bucket=BUCKET_NAME)

    trash_files = []

    if 'Contents' in response:
        for obj in response['Contents']:
            filename = obj['Key']

            if filename.startswith("trash/"):
                clean_name = filename.replace("trash/", "")
                trash_files.append({
                    "name": clean_name,
                    "original": filename
                })

    return jsonify({"files": trash_files})


# Download file
@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    if 'user' not in session:
        return redirect('/login')

    url = s3.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': BUCKET_NAME,
            'Key': filename
        },
        ExpiresIn=3600
    )

    return redirect(url)


# Delete → move to trash
@app.route('/delete/<filename>', methods=['GET', 'POST'])
def delete_file(filename):
    if 'user' not in session:
        return redirect('/login')

    s3.copy_object(
        Bucket=BUCKET_NAME,
        CopySource={'Bucket': BUCKET_NAME, 'Key': filename},
        Key=f"trash/{filename}"
    )

    s3.delete_object(Bucket=BUCKET_NAME, Key=filename)

    return jsonify({"message": "Moved to trash"})


# Clear trash
@app.route('/clear-trash', methods=['GET', 'POST'])
def clear_trash():
    if 'user' not in session:
        return redirect('/login')

    response = s3.list_objects_v2(Bucket=BUCKET_NAME)

    if 'Contents' in response:
        for obj in response['Contents']:
            key = obj['Key']
            if key.startswith("trash/"):
                s3.delete_object(Bucket=BUCKET_NAME, Key=key)

    return jsonify({"message": "Trash cleared"})


# Restore file
@app.route('/restore/<filename>', methods=['POST'])
def restore_file(filename):
    if 'user' not in session:
        return redirect('/login')

    s3.copy_object(
        Bucket=BUCKET_NAME,
        CopySource={'Bucket': BUCKET_NAME, 'Key': f"trash/{filename}"},
        Key=filename
    )

    s3.delete_object(Bucket=BUCKET_NAME, Key=f"trash/{filename}")

    return jsonify({"message": "Restored successfully"})


# Run app
if __name__ == "__main__":
    app.run(debug=True)


