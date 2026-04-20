import os
import boto3
from flask import Flask, request, redirect, render_template, session

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB
app.secret_key = 'mysecret123'


s3 = boto3.client(
    's3',
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_KEY"),
    region_name='ap-south-1'
)

BUCKET_NAME = 'awss3-my-cloud-2026'


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if username == 'admin' and password == '1234':
            session['user'] = username
            return redirect('/')
        else:
            return "Invalid credentials"

    return render_template('login.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'user' not in session:
        return redirect('/login')

    file = request.files['file']
    s3.upload_fileobj(file, BUCKET_NAME, file.filename)
    return "File uploaded successfully!"

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

            if ext in ['jpg', 'png']:
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

    return {
        "files": files,
        "total_storage_mb": total_storage_mb
    }

@app.route('/trash', methods=['GET'])
def get_trash():
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

    return {"files": trash_files}

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

@app.route('/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    
    s3.copy_object(
        Bucket=BUCKET_NAME,
        CopySource={'Bucket': BUCKET_NAME, 'Key': filename},
        Key=f"trash/{filename}"
    )

  
    s3.delete_object(Bucket=BUCKET_NAME, Key=filename)

    return {"message": "Moved to trash"}

@app.route('/clear-trash', methods=['DELETE'])
def clear_trash():
    response = s3.list_objects_v2(Bucket=BUCKET_NAME)

    if 'Contents' in response:
        for obj in response['Contents']:
            key = obj['Key']
            if key.startswith("trash/"):
                s3.delete_object(Bucket=BUCKET_NAME, Key=key)

    return {"message": "Trash cleared"}

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

    return {"message": "Restored successfully"}

if __name__ == "__main__":
    app.run(debug=True)