import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function configureS3Cors() {
  console.log("🔄 Starting S3 CORS configuration...");

  // Get S3 configuration from environment variables
  const region = process.env.AWS_REGION;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  // Validate required configuration
  if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
    console.error("❌ Missing required S3 configuration in .env file");
    console.error(
      "Required variables: AWS_REGION, AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    );
    process.exit(1);
  }

  // Initialize S3 client
  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // CORS configuration allowing all origins
  const corsConfig = {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "HEAD", "PUT", "POST", "DELETE"],
        AllowedOrigins: ["*"],
        ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
        MaxAgeSeconds: 86400,
      },
    ],
  };

  try {
    // Apply CORS configuration to the bucket
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfig,
    });

    await s3Client.send(command);
    console.log(`✅ Successfully configured CORS for S3 bucket: ${bucketName}`);
    console.log("CORS configuration applied:");
    console.log(JSON.stringify(corsConfig, null, 2));
  } catch (error) {
    console.error("❌ Error configuring S3 CORS:", error);
    process.exit(1);
  }
}

configureS3Cors();
