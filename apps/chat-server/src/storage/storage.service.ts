import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = 'chat-files';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly publicClient: S3Client;

  constructor() {
    const credentials = {
      accessKeyId: process.env.MINIO_ROOT_USER || 'admin',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'password',
    };
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
      forcePathStyle: true,
      credentials,
    });
    this.publicClient = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
      forcePathStyle: true,
      credentials,
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    }
  }

  async uploadFile(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }

  async getDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(this.publicClient, command, {
      expiresIn: expiresInSeconds,
    });
  }
  async checkConnection(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  }
}
