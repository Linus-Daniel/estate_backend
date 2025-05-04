import cloudinary from "cloudinary";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();




export class CloudinaryService {

	constructor() {
		// Initialize cloudinary
		this.cloudinaryV2 = cloudinary.v2;

		// Configure Cloudinary
		this.cloudinaryV2.config({
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
			api_key: process.env.CLOUDINARY_API_KEY,
			api_secret: process.env.CLOUDINARY_API_SECRET,
		});
	}

	/**
	 * Upload an image to Cloudinary
	 * @param filePath Path to the file to upload
	 * @param options Optional upload options
	 * @returns Promise with upload result
	 */
	 async uploadImage(
		filePath,
		options
	){
		const defaultOptions = {
			folder: "uploads",
			...options,
		};

		return (await this.cloudinaryV2.uploader.upload(
			filePath,
			defaultOptions
		)) ;
	}

	/**
	 * Delete an image from Cloudinary
	 * @param publicId Public ID of the image to delete
	 * @returns Promise with deletion result
	 */
 async deleteImage(
		publicId
	) {
		return await this.cloudinaryV2.uploader.destroy(publicId);
	}
}
