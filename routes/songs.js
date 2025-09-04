const express = require("express");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Firestore
const db = admin.firestore();

// sanitize ชื่อไฟล์
function sanitizeFileName(filename) {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]/g, '_');
}

// POST /songs
router.post("/add-song", upload.fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files["file"]) {
      return res.status(400).json({ message: "No audio file uploaded." });
    }

    const audioFile = req.files["file"][0];
    const imageFile = req.files["image"]?.[0] || null;

    // อัปโหลดเพลงไป Supabase
    const audioFileName = `${Date.now()}_${sanitizeFileName(audioFile.originalname)}`;
    const { error: audioError } = await supabase
      .storage
      .from("songs")
      .upload(audioFileName, audioFile.buffer, { contentType: audioFile.mimetype, upsert: true });
    if (audioError) throw audioError;
    const audioUrl = supabase.storage.from("songs").getPublicUrl(audioFileName).data.publicUrl;

    // อัปโหลดรูปภาพ
    let imageUrl = null;
    if (imageFile) {
      const imageFileName = `${Date.now()}_${sanitizeFileName(imageFile.originalname)}`;
      const { error: imageError } = await supabase
        .storage
        .from("image")
        .upload(imageFileName, imageFile.buffer, { contentType: imageFile.mimetype, upsert: true });
      if (imageError) throw imageError;
      imageUrl = supabase.storage.from("image").getPublicUrl(imageFileName).data.publicUrl;
    }

    // บันทึกลง Firestore
    const songRef = await db.collection("songs").add({
      name: req.body.name || audioFile.originalname,
      artist: req.body.artist || "Unknown",
      category: req.body.category || "Uncategorized",
      audioUrl,
      imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
  message: "Song uploaded successfully!",
  songId: songRef.id,
  audioUrl,
  imageUrl
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading song", error: err.message });
  }
});

// GET /songs
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("songs").orderBy("createdAt", "desc").get();
    const songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(songs.length > 0 ? 200 : 404).json(songs.length > 0 ? songs : { message: 'No songs found.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching songs', error: err.message });
  }
});

// GET /songs/category/:category
router.get("/category/:category", async (req, res) => {
  try {
    const categoryParam = req.params.category;
    let dbCategory;
    if (categoryParam === 'ผู้สูงวัย') dbCategory = 'เพลงสำหรับผู้สูงวัย';
    else if (categoryParam === 'เปียโน') dbCategory = 'ดนตรีเปียโน';
    else dbCategory = categoryParam;

    const snapshot = await db.collection('songs')
      .where('category', '==', dbCategory)
      .orderBy('createdAt', 'desc')
      .get();

    const songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(songs.length > 0 ? 200 : 404).json(songs.length > 0 ? songs : { message: 'ไม่พบเพลงในหมวดหมู่นี้' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching songs by category', error: err.message });
  }
});

router.delete("/delete-song/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ดึงข้อมูลเพลงจาก Firestore
    const docRef = db.collection("songs").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ message: 'เพลงไม่พบ' });

    const data = doc.data();
    const audioUrl = data.audioUrl;
    const imageUrl = data.imageUrl;

    // ลบไฟล์ใน Supabase
    if (audioUrl) {
      const audioPath = audioUrl.split("/storage/v1/object/public/songs/")[1];
      await supabase.storage.from("songs").remove([audioPath]);
    }

    if (imageUrl) {
      const imagePath = imageUrl.split("/storage/v1/object/public/image/")[1];
      await supabase.storage.from("image").remove([imagePath]);
    }

    // ลบเอกสารใน Firestore
    await docRef.delete();

    res.status(200).json({ message: 'ลบเพลงสำเร็จทั้งใน Firestore และ Supabase' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
});


module.exports = router;
