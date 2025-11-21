// config/s3.js
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const region = process.env.AWS_REGION || 'ap-south-1';
const bucket = process.env.S3_BUCKET;

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !bucket) {
  console.warn('Warning: AWS credentials or S3_BUCKET not set in env. S3 functions will fail.');
}

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region,
  signatureVersion: 'v4'
});

function getSignedUploadUrl({ KeyPrefix = '', contentType = 'application/octet-stream', expiresSeconds = 60 } = {}) {
  if (!bucket) throw new Error('S3_BUCKET not configured');
  const key = `${KeyPrefix}${uuidv4()}`;
  const params = {
    Bucket: bucket,
    Key: key,
    Expires: expiresSeconds,
    ContentType: contentType,
  };
  const url = s3.getSignedUrl('putObject', params);
  return { key, url, publicUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}` };
}


async function uploadBuffer(buffer, { KeyPrefix = '', contentType = 'application/octet-stream' } = {}) {
  if (!buffer) throw new Error('Buffer required');
  if (!bucket) throw new Error('S3_BUCKET not configured');

  const key = `${KeyPrefix}${uuidv4()}`;
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  };

  const res = await s3.upload(params).promise();
  return { key, location: res.Location };
}

module.exports = { s3, getSignedUploadUrl, uploadBuffer };
