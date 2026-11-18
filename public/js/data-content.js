// =========================================================================
// KONTEN ILMIAH & LITERASI EMOSI EMOSIKU (SMP - SMA)
// Desain Minimalis & Elegan (Tanpa Emoji/Ikon Kartun)
// Berdasarkan Proposal Bab I - III (Goleman, Gross, Santrock, REBT, & Nilai Islam)
// =========================================================================

window.EMOSIKU_CONTENT = {
  emotions: [
    {
      id: "senang",
      name: "Senang",
      code: "SN",
      category: "Afek Positif",
      dotColor: "bg-amber-500",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-amber-50 text-amber-800 border border-amber-200",
      chartColor: "#d97706",
      meaning:
        "Perasaan hangat, puas, dan bersemangat ketika mengalami hal yang baik atau mencapai sesuatu yang diharapkan.",
      bodySigns:
        "Wajah rileks, dada terasa lapang, energi tubuh meningkat, dan napas terasa ringan.",
      commonThoughts:
        '"Alhamdulillah usahaku berhasil", "Aku merasa dihargai hari ini", "Belajar bersama teman terasa menyenangkan."',
      emotionFunction:
        "Memberi sinyal bahwa situasi saat ini aman dan mendukung, serta memotivasi diri untuk terus berbagi kebaikan.",
      schoolExample:
        "Berhasil menjawab pertanyaan di kelas, mendapat hasil evaluasi yang memuaskan, atau berdiskusi hangat bersama teman.",
      recommendedStrategyId: "zikir-syukur",
    },
    {
      id: "tenang",
      name: "Tenang",
      code: "TN",
      category: "Afek Positif",
      dotColor: "bg-teal-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-teal-50 text-teal-800 border border-teal-200",
      chartColor: "#0d9488",
      meaning:
        "Kondisi batin yang damai, stabil, tidak terburu-buru, dan mampu berpikir jernih menghadapi situasi sekitar.",
      bodySigns:
        "Detak jantung teratur, bahu tidak tegang, napas dalam dan perlahan, pikiran terasa fokus.",
      commonThoughts:
        '"Aku bisa menjalani hari ini selangkah demi selangkah", "Semua masih dalam kendali yang wajar."',
      emotionFunction:
        "Membantu otak berpikir rasional, mengambil keputusan bijak, dan memulihkan energi tubuh maupun mental.",
      schoolExample:
        "Siap menghadapi ujian karena sudah belajar dengan teratur dan berdoa sebelum mengerjakan soal.",
      recommendedStrategyId: "zikir-syukur",
    },
    {
      id: "sedih",
      name: "Sedih",
      code: "SD",
      category: "Perlu Perhatian",
      dotColor: "bg-sky-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-sky-50 text-sky-800 border border-sky-200",
      chartColor: "#0284c7",
      meaning:
        "Perasaan berat atau pedih di hati ketika kehilangan sesuatu yang berharga, merasa sendirian, atau harapan belum terwujud.",
      bodySigns:
        "Mata terasa hangat atau ingin menangis, dada terasa berat, tubuh terasa lemas, ingin menyendiri.",
      commonThoughts:
        '"Mengapa hal ini terjadi padaku?", "Rasanya belum ada yang memahami perasaanku saat ini."',
      emotionFunction:
        "Memberi waktu bagi diri untuk berhenti sejenak, menerima kenyataan, dan memberi sinyal bahwa kita membutuhkan dukungan.",
      schoolExample:
        "Sahabat dekat pindah sekolah, merasa renggang dengan teman sebangku, atau terbawa suasana masalah keluarga.",
      recommendedStrategyId: "reappraisal",
    },
    {
      id: "marah",
      name: "Marah",
      code: "MR",
      category: "Perlu Regulasi",
      dotColor: "bg-rose-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-rose-50 text-rose-800 border border-rose-200",
      chartColor: "#e11d48",
      meaning:
        "Respons emosi yang kuat ketika merasa diperlakukan tidak adil, dilanggar batasnya, dihina, atau terhalang tujuannya.",
      bodySigns:
        "Detak jantung cepat, wajah terasa panas, tangan mengepal, rahang mengeras, nada bicara meninggi.",
      commonThoughts:
        '"Ini tidak adil", "Dia sengaja meremehkanku", "Aku ingin langsung membalas ucapannya."',
      emotionFunction:
        "Memberi tahu bahwa ada batasan diri atau keadilan yang terganggu. Perlu dikelola agar tidak menjadi perilaku agresif.",
      schoolExample:
        "Anggota kelompok tidak mengerjakan bagian tugasnya, diejek di kelas, atau terjadi kesalahpahaman komunikasi.",
      recommendedStrategyId: "box-breathing",
    },
    {
      id: "cemas",
      name: "Cemas",
      code: "CM",
      category: "Perlu Regulasi",
      dotColor: "bg-violet-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-violet-50 text-violet-800 border border-violet-200",
      chartColor: "#7c3aed",
      meaning:
        "Perasaan gelisah, khawatir berlebihan, atau tidak tenang terhadap hal buruk yang belum tentu terjadi di masa depan.",
      bodySigns:
        "Jantung berdebar kencang, telapak tangan dingin atau berkeringat, perut terasa kurang nyaman, sulit berkonsentrasi.",
      commonThoughts:
        '"Bagaimana kalau nanti aku salah bicara di depan kelas?", "Bagaimana kalau nilaiku turun?"',
      emotionFunction:
        "Mengingatkan diri untuk bersiap menghadapi tantangan penting, selama intensitasnya diturunkan agar tetap fokus.",
      schoolExample:
        "Menjelang presentasi di depan kelas, menunggu pengumuman nilai ujian, atau menghadapi tenggat tugas yang padat.",
      recommendedStrategyId: "grounding",
    },
    {
      id: "takut",
      name: "Takut",
      code: "TK",
      category: "Perlu Regulasi",
      dotColor: "bg-indigo-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-indigo-50 text-indigo-800 border border-indigo-200",
      chartColor: "#4f46e5",
      meaning:
        "Emosi alarm alami ketika menghadapi ancaman nyata, bahaya, atau tekanan yang terasa mengintimidasi.",
      bodySigns:
        "Tubuh gemetar, napas pendek dan cepat, otot menegang, ingin segera menghindar dari situasi tersebut.",
      commonThoughts:
        '"Situasi ini terasa tidak aman untukku", "Aku khawatir dimarahi", "Aku ragu menghadapi situasi itu."',
      emotionFunction:
        "Melindungi keselamatan diri dari bahaya dan mendorong kita mencari bantuan orang dewasa tepercaya seperti Guru BK.",
      schoolExample:
        "Mengalami tekanan atau intimidasi dari lingkungan pergaulan, atau takut dipanggil karena suatu kesalahan.",
      recommendedStrategyId: "grounding",
    },
    {
      id: "kecewa",
      name: "Kecewa",
      code: "KC",
      category: "Perlu Perhatian",
      dotColor: "bg-orange-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-orange-50 text-orange-800 border border-orange-200",
      chartColor: "#ea580c",
      meaning:
        "Perasaan tidak puas dan sedih ketika kenyataan yang terjadi tidak sesuai dengan harapan, janji, atau usaha keras.",
      bodySigns:
        "Menghela napas panjang, bahu terasa berat, dada terasa mengganjal, kehilangan motivasi sesaat.",
      commonThoughts:
        '"Padahal aku sudah belajar semalaman, mengapa hasilnya belum maksimal?", "Temanku mengingkari janjinya."',
      emotionFunction:
        "Membantu mengevaluasi kembali harapan dan strategi belajar maupun berteman agar lebih realistis ke depannya.",
      schoolExample:
        "Belum berhasil lolos seleksi kegiatan sekolah atau nilai kuis belum mencapai target meskipun sudah berusaha.",
      recommendedStrategyId: "reappraisal",
    },
    {
      id: "malu",
      name: "Malu",
      code: "ML",
      category: "Perlu Perhatian",
      dotColor: "bg-pink-600",
      colorBg: "bg-white",
      colorBorder: "border-slate-200",
      badgeColor: "bg-pink-50 text-pink-800 border border-pink-200",
      chartColor: "#db2777",
      meaning:
        "Perasaan canggung dan tidak nyaman ketika merasa menjadi pusat perhatian karena kekurangan atau kekeliruan.",
      bodySigns:
        "Wajah terasa hangat, menundukkan pandangan, suara mengecil, ingin menarik diri.",
      commonThoughts:
        '"Jangan-jangan teman sekelas memperhatikan kesalahanku", "Aku merasa sangat canggung tadi."',
      emotionFunction:
        "Menjaga kepekaan terhadap etika sosial, namun perlu dikelola agar tidak menghambat rasa percaya diri.",
      schoolExample:
        "Keliru mengucapkan jawaban saat ditunjuk pengajar, atau canggung memulai percakapan di lingkungan baru.",
      recommendedStrategyId: "reappraisal",
    },
  ],

  calmStrategies: [
    {
      id: "box-breathing",
      number: "01",
      title: "Napas Kotak 4-4-4-4",
      subtitle:
        "Menurunkan ketegangan fisiologis dan menstabilkan detak jantung saat marah atau panik",
      badge: "Regulasi Fisiologis • 2 Menit",
      bestFor: ["marah", "cemas", "takut"],
      theoryNote:
        "Menurunkan aktivasi saraf simpatis agar korteks prefrontal otak kembali jernih sebelum mengambil keputusan.",
      steps: [
        "Duduk dengan posisi tegak namun rileks, letakkan kedua tangan dengan tenang.",
        "Tarik napas perlahan melalui hidung selama 4 detik hingga paru-paru terasa terisi.",
        "Tahan napas dengan tenang selama 4 detik tanpa menegangkan otot bahu.",
        "Hembuskan napas perlahan melalui mulut selama 4 detik sambil melepaskan ketegangan.",
        "Pertahankan jeda tenang selama 4 detik sebelum mengulangi siklus selama 2 menit.",
      ],
    },
    {
      id: "grounding",
      number: "02",
      title: "Grounding 5-4-3-2-1",
      subtitle:
        "Mengembalikan orientasi kesadaran ke masa kini saat pikiran cemas berlebihan",
      badge: "Orientasi Sensorik • Fokus",
      bestFor: ["cemas", "takut"],
      theoryNote:
        "Teknik berbasis kesadaran penuh (mindfulness) untuk memutus rantai pikiran mengkhawatirkan melalui pengamatan panca indra.",
      steps: [
        "5 Hal yang Dapat Dilihat: Amati 5 benda nyata di sekitarmu saat ini secara perlahan.",
        "4 Hal yang Dapat Disentuh: Rasakan 4 tekstur permukaan di dekatmu (meja, buku, pakaian, lantai).",
        "3 Suara yang Dapat Didengar: Fokuskan pendengaran pada 3 suara latar di lingkungan sekitar.",
        "2 Aroma yang Dapat Disadari: Sadari hembusan udara yang masuk dan keluar melalui hidung.",
        '1 Afirmasi Rasional: Ucapkan kalimat tenang, "Saat ini aku berada di tempat yang aman dan mampu berpikir jernih."',
      ],
    },
    {
      id: "reappraisal",
      number: "03",
      title: "Ubah Sudut Pandang (Reappraisal)",
      subtitle:
        "Menata ulang pikiran otomatis yang negatif menjadi penilaian yang lebih objektif",
      badge: "Restrukturisasi Kognitif • Gross & REBT",
      bestFor: ["kecewa", "sedih", "malu", "marah"],
      theoryNote:
        "Mengadaptasi konsep Cognitive Reappraisal (Gross) dan REBT: respons emosional dibentuk oleh cara kita memaknai suatu peristiwa.",
      steps: [
        "Identifikasi Pikiran Otomatis: Kenali asumsi awal yang langsung muncul saat peristiwa terjadi.",
        "Evaluasi Bukti Objektif: Tanyakan apakah asumsi tersebut sepenuhnya fakta atau sekadar prasangka sesaat.",
        "Rumuskan Sudut Pandang Alternatif: Ganti kalimat menyalahkan diri dengan kalimat evaluasi yang membangun.",
        "Fokus pada Ruang Kendali: Arahkan energi pada langkah nyata yang dapat diperbaiki hari ini.",
      ],
    },
    {
      id: "zikir-syukur",
      number: "04",
      title: "Tenang dengan Zikir, Wudu & Syukur",
      subtitle:
        "Pendekatan spiritual untuk menenteramkan hati dan mengendalikan amarah",
      badge: "Refleksi Spiritual (Opsional)",
      bestFor: ["marah", "cemas", "sedih", "senang", "tenang"],
      theoryNote:
        "Berlandaskan QS. Ali 'Imran [3]: 134 tentang menahan amarah dan memaafkan, serta QS. Ar-Ra'd [13]: 28 tentang ketenangan hati melalui zikir.",
      steps: [
        "Ubah Posisi Tubuh: Jika sedang marah dalam posisi berdiri, duduklah; basuh wajah dan anggota wudu untuk menyejukkan diri.",
        "Lafalkan Kalimat Thayyibah: Tarik napas perlahan sembari melafalkan Ta'awudz dan Istighfar dengan penuh kesadaran.",
        'Zikir Penenang Batin: Resapi makna "Laa haula wa laa quwwata illa billah" untuk melepaskan beban di luar kendali manusia.',
        "Refleksi Syukur & Sabar: Catat satu hal baik yang masih dimiliki hari ini dan niatkan merespons keadaan secara bijaksana.",
      ],
    },
  ],

  triggers: ["Sekolah", "Teman", "Keluarga", "Diri sendiri", "Lainnya"],
};
