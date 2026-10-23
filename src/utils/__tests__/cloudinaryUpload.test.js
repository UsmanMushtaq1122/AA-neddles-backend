const { Writable } = require("stream");

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
    url: jest.fn(),
  },
}));
jest.mock("../../config/env", () => ({
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
}));
jest.mock("../../config/logger", () => ({
  error: jest.fn(),
}));

const cloudinary = require("cloudinary").v2;
const { uploadImageBuffer } = require("../cloudinary");

function mockUploadStream(callbackResult) {
  return (options, callback) => {
    const stream = new Writable({
      write(chunk, encoding, done) {
        done();
      },
    });
    stream.on("finish", () => callback(...callbackResult));
    return stream;
  };
}

describe("uploadImageBuffer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("retries a transient Cloudinary failure and returns the uploaded image", async () => {
    const uploadedImage = {
      secure_url: "https://res.cloudinary.com/test/image/upload/banner.jpg",
      public_id: "banners/123",
      bytes: 4,
    };
    cloudinary.uploader.upload_stream
      .mockImplementationOnce(
        mockUploadStream([Object.assign(new Error("Bad gateway"), { http_code: 502 })])
      )
      .mockImplementationOnce(mockUploadStream([null, uploadedImage]));

    await expect(uploadImageBuffer(Buffer.from("test"))).resolves.toEqual({
      path: uploadedImage.secure_url,
      filename: uploadedImage.public_id,
      size: uploadedImage.bytes,
    });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(2);
    expect(cloudinary.uploader.upload_stream).toHaveBeenLastCalledWith(
      expect.objectContaining({ overwrite: true, timeout: 60000 }),
      expect.any(Function)
    );
  });

  test("logs the original Cloudinary error when an upload is rejected", async () => {
    const originalError = {
      message: "Server returned unexpected status code - 403",
      http_code: 403,
      name: "UnexpectedResponse",
    };
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    cloudinary.uploader.upload_stream.mockImplementation(
      mockUploadStream([originalError])
    );

    await expect(uploadImageBuffer(Buffer.from("test"))).rejects.toThrow(
      "Cloudinary rejected the upload."
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Cloudinary original upload error:",
      originalError
    );
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
