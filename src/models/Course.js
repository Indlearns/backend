import mongoose from "mongoose";



const courseSchema = new mongoose.Schema(

  {

    title: { type: String, required: true, trim: true },

    description: { type: String, default: "" },

    category: { type: String, default: "General" },

    duration: { type: String, default: "" },

    /** Last day students can enroll (inclusive). Omit = no deadline. */

    enrollmentCloseDate: { type: Date, default: null },

    status: {

      type: String,

      enum: ["draft", "published", "archived"],

      default: "draft",

    },

    /** Course cover image URL path e.g. /uploads/courses/xxx.jpg */

    thumbnail: { type: String, default: "" },

    /** Price in INR (rupees). 0 = free course */

    price: { type: Number, default: 0, min: 0 },

    currency: { type: String, default: "INR" },

    isFree: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  },

  { timestamps: true }

);



courseSchema.pre("save", function (next) {

  if (this.price <= 0) this.isFree = true;

  else this.isFree = false;

  next();

});



export default mongoose.model("Course", courseSchema);

