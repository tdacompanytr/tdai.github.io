// Gerekli kütüphaneleri içe aktarıyoruz
// Bu, sunucusuz ortamda çalışacağı için 'require' kullanıyoruz.
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Netlify Fonksiyonunun Ana Giriş Noktası
 * Bu fonksiyon, sitenizden (frontend) bir mesaj geldiğinde çalışır.
 * * @param {object} event - Gelen HTTP isteğinin bilgilerini içerir.
 * @returns {object} - HTTP cevabını (AI'dan gelen mesajı) döndürür.
 */
exports.handler = async (event) => {
  // Yalnızca POST isteklerini kabul et
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Sadece POST metoduna izin verilir." }) 
    };
  }

  // CORS politikaları (Farklı domainlerden erişim) Netlify'da otomatik yönetildiği için, 
  // Firebase'deki gibi ek CORS koduna burada gerek yoktur.
  
  try {
    // 1. GİZLİ ANAHTARI GÜVENLİ KASADAN ALMA (Netlify Ortam Değişkenleri)
    // Netlify'da bu anahtar, process.env ile eriştiğimiz gizli değişkendir.
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
        throw new Error("API Anahtarı bulunamadı. Lütfen Netlify Ayarlarına ekleyin.");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);

    // 2. İsteğin gövdesinden (body) sitenizden gelen mesajı alma
    const body = JSON.parse(event.body);
    const userMessage = body.message;

    if (!userMessage) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Lütfen bir mesaj gönderin." }),
      };
    }
    
    // 3. Gemini API'a bağlanma ve isteği gönderme
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(userMessage);
    const aiResponseText = result.text;
    
    // 4. Cevabı başarılı (200) koduyla siteye geri gönderme
    return {
      statusCode: 200,
      body: JSON.stringify({ message: aiResponseText }),
    };
    
  } catch (error) {
    // Hata durumunda, hatayı konsolda göster ve 500 koduyla siteye hata mesajı gönder
    console.error("Fonksiyon veya Gemini API Hatası:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Yapay zekadan cevap alınırken bir hata oluştu." }),
    };
  }
};
