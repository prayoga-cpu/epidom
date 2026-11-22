import type { LandingPage } from "../types";

export const recipeCostPages: LandingPage[] = [
  {
    slug: "calcul-cout-de-revient",
    locale: "fr",
    group: "recipe-cost",
    kind: "tool",
    tool: "recipe-cost",
    metaTitle: "Calcul coût de revient d'un plat : calculateur",
    metaDescription:
      "Calcul coût de revient : saisissez vos ingrédients, obtenez le coût par portion, le prix pour votre ratio matière cible et votre marge. Exemple chiffré.",
    eyebrow: "Calculateur gratuit",
    h1: "Calcul du coût de revient d'un plat ou d'un produit",
    lede: "Le coût de revient d'un plat, c'est la somme de ce que coûte chaque ingrédient utilisé, plus l'emballage, divisée par le nombre de portions. Le calculateur ci-dessous le fait pour vous et en déduit le prix de vente qui respecte votre ratio matière.",
    blocks: [
      { type: "h2", text: "Ce que le calculateur fait" },
      {
        type: "p",
        text: "Pour chaque ingrédient, indiquez le prix du paquet, le poids ou le volume du paquet et la quantité utilisée dans la recette. Ajoutez le nombre de portions, l'emballage par portion et le ratio matière que vous visez. Si vous avez déjà un prix de vente, saisissez-le pour voir votre ratio et votre marge réels.",
      },
      { type: "tool" },
      { type: "h2", text: "La formule du coût de revient d'un plat" },
      {
        type: "p",
        text: "Chaque ingrédient se calcule de la même façon : prix du paquet divisé par la quantité du paquet, multiplié par la quantité utilisée. On additionne tous les ingrédients, on divise par le nombre de portions, puis on ajoute l'emballage d'une portion.",
      },
      {
        type: "callout",
        text: "Coût d'un ingrédient = (prix du paquet ÷ quantité du paquet) × quantité utilisée. Coût de revient par portion = (somme des ingrédients ÷ portions) + emballage. Prix de vente conseillé = coût de revient ÷ ratio matière cible. Ratio matière = coût de revient ÷ prix de vente HT.",
      },
      { type: "h2", text: "Exemple chiffré : un croissant en boulangerie" },
      {
        type: "p",
        text: "Une fournée de 20 croissants utilise 1 kg de farine (sac de 25 kg à 22 €, soit 0,88 €), 500 g de beurre (1 kg à 9,50 €, soit 4,75 €), 250 ml de lait (0,28 €), 100 g de sucre (0,14 €) et un sachet de levure (0,35 €). Total des ingrédients : environ 6,40 €, soit 0,32 € par croissant. Avec un sachet papier à 0,05 €, le coût de revient est de 0,37 €.",
      },
      {
        type: "p",
        text: "Avec un ratio matière visé de 30 %, le prix conseillé est 0,37 ÷ 0,30, soit 1,23 €. Vendu 1,20 €, le croissant donne un ratio de 30,8 % et une marge brute de 0,83 € par pièce, soit 69,2 %. Ce calcul ne couvre que la matière : loyer, salaires et charges restent à financer avec cette marge.",
      },
      { type: "h2", text: "Calculer le prix de vente à partir du coût de revient" },
      {
        type: "steps",
        items: [
          {
            title: "Listez chaque ingrédient de la fiche technique",
            text: "Notez la quantité exacte par recette, pesée et non estimée. Pensez aux petits ajouts : huile, sel, sauce, garniture, décoration.",
          },
          {
            title: "Convertissez le prix du paquet en prix par gramme ou par litre",
            text: "Utilisez le prix de la dernière facture fournisseur, pas celui d'il y a six mois. Le beurre et les œufs bougent vite.",
          },
          {
            title: "Divisez par le nombre de portions réellement vendues",
            text: "Si une fournée perd de la matière à la cuisson ou au parage, comptez les portions que vous vendez, pas celles prévues.",
          },
          {
            title: "Ajoutez l'emballage",
            text: "Gobelet, couvercle, sachet, boîte : c'est un coût matière comme un autre dès que le produit part à emporter.",
          },
          {
            title: "Divisez par votre ratio matière cible",
            text: "Vous obtenez le prix de vente minimal. Arrondissez ensuite à un prix psychologique, puis contrôlez le ratio obtenu.",
          },
        ],
      },
      { type: "h2", text: "Quel ratio matière viser ?" },
      {
        type: "p",
        text: "Il n'existe pas de chiffre universel. Une règle empirique courante place le coût matière entre 25 et 35 % du prix de vente hors taxes en restauration. Les boissons chaudes sont souvent plus basses, un plat à base de viande ou de poisson plus haut. Ce qui compte, c'est que la marge brute couvre vos salaires, votre loyer et vos charges.",
      },
      { type: "h2", text: "Quand le tableur ne suffit plus : le calcul automatique dans Epidom" },
      {
        type: "p",
        text: "Un calcul à la main reste exact le jour où vous le faites. Dès que le prix du beurre change, il faut tout refaire. Avec le forfait Operations d'Epidom, vous créez la recette une fois avec ses quantités : le coût de revient de chaque plat se calcule automatiquement à partir des prix de vos ingrédients, et le stock est déduit à chaque vente.",
      },
      {
        type: "list",
        items: [
          "Catalogue d'ingrédients avec prix, mis à jour à chaque achat",
          "Recettes avec quantités et coût de revient calculé tout seul",
          "Stock déduit à chaque commande terminée, alertes de stock bas",
          "Marge par article et marge brute dans les rapports financiers",
        ],
      },
      {
        type: "p",
        text: "Le forfait Operations coûte 27,99 € par mois (23,49 € par mois en abonnement annuel) et inclut le forfait POS.",
      },
    ],
    faqs: [
      {
        q: "Comment calculer le coût de revient d'un plat ?",
        a: "Additionnez le coût de chaque ingrédient utilisé (prix du paquet ÷ quantité du paquet × quantité utilisée), divisez par le nombre de portions, puis ajoutez l'emballage d'une portion. Le résultat est votre coût de revient par portion.",
      },
      {
        q: "Qu'est-ce qu'une fiche technique ?",
        a: "C'est la recette détaillée d'un plat avec les quantités exactes de chaque ingrédient, le nombre de portions et le coût associé. Elle sert à garder une qualité constante et à calculer le coût de revient et le prix de vente.",
      },
      {
        q: "Comment calculer le prix de vente d'un plat au restaurant ?",
        a: "Divisez le coût de revient par le ratio matière que vous visez. Avec un coût de 3 € et un ratio de 30 %, le prix conseillé est de 10 € hors taxes. Ajoutez ensuite la TVA applicable pour obtenir le prix affiché.",
      },
      {
        q: "Quel est un bon ratio matière en restauration ?",
        a: "Une règle empirique courante est de 25 à 35 % du prix de vente hors taxes, mais cela varie selon le type d'établissement et de produit. Suivez votre propre ratio plat par plat plutôt qu'une moyenne.",
      },
      {
        q: "Combien coûte le calcul automatique du coût de revient dans Epidom ?",
        a: "Il est inclus dans le forfait Operations, à 27,99 € par mois (23,49 € par mois en annuel), avec le POS. Le calculateur de cette page reste gratuit et sans inscription.",
      },
    ],
    cta: {
      title: "Que le coût de revient se calcule tout seul",
      text: "Avec le forfait Operations, chaque recette met à jour son coût de revient quand le prix d'un ingrédient change, et le stock suit vos ventes.",
      button: "Voir les forfaits →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "kalkulator-hpp",
    locale: "id",
    group: "recipe-cost",
    kind: "tool",
    tool: "recipe-cost",
    metaTitle: "Kalkulator HPP Makanan & Minuman untuk Menu",
    metaDescription:
      "Kalkulator HPP: isi bahan, harga kemasan, dan takaran untuk tahu HPP per porsi, harga jual sesuai target food cost, dan margin. Ada contoh hitungan.",
    eyebrow: "Kalkulator gratis",
    h1: "Kalkulator HPP: cara menghitung HPP makanan dan minuman",
    lede: "HPP per porsi adalah total biaya bahan dan kemasan satu resep dibagi jumlah porsi. Kalkulator di bawah menghitungnya dan langsung menunjukkan harga jual yang sesuai target food cost Anda.",
    blocks: [
      { type: "h2", text: "Cara memakai kalkulator" },
      {
        type: "p",
        text: "Untuk tiap bahan, isi harga kemasan, isi atau berat kemasan, dan jumlah yang dipakai di resep. Lalu isi jumlah porsi, biaya kemasan per porsi, dan target food cost. Jika sudah punya harga jual, masukkan juga untuk melihat food cost dan margin sebenarnya.",
      },
      { type: "tool" },
      { type: "h2", text: "Rumus HPP yang dipakai" },
      {
        type: "p",
        text: "Hitung tiap bahan dengan cara yang sama: harga kemasan dibagi isi kemasan, dikali jumlah yang dipakai. Jumlahkan semua bahan, bagi dengan jumlah porsi, lalu tambahkan biaya kemasan satu porsi.",
      },
      {
        type: "callout",
        text: "HPP bahan = (harga kemasan ÷ isi kemasan) × jumlah dipakai. HPP per porsi = (total bahan ÷ porsi) + kemasan. Harga jual = HPP per porsi ÷ target food cost. Food cost % = HPP per porsi ÷ harga jual.",
      },
      { type: "h2", text: "Contoh hitungan: es kopi susu" },
      {
        type: "p",
        text: "Satu gelas es kopi susu memakai 15 gram biji kopi (kemasan 1 kg Rp 150.000, jadi Rp 2.250), 120 ml susu (1 liter Rp 20.000, jadi Rp 2.400), 20 ml sirup gula aren (1 liter Rp 40.000, jadi Rp 800), es batu Rp 500, serta cup dan tutup Rp 1.200. Total HPP per gelas adalah Rp 7.150.",
      },
      {
        type: "p",
        text: "Dengan target food cost 30%, harga jual yang disarankan adalah 7.150 ÷ 0,30, kira-kira Rp 23.800. Kalau Anda menjualnya Rp 22.000, food cost-nya 32,5% dan margin kotor Rp 14.850 per gelas, atau 67,5%. Angka ini baru menghitung bahan; sewa, gaji, dan listrik tetap harus dibayar dari margin tersebut.",
      },
      { type: "h2", text: "Langkah menghitung HPP menu kafe" },
      {
        type: "steps",
        items: [
          {
            title: "Tulis resep standar tiap menu",
            text: "Catat takaran yang benar-benar dipakai, ditimbang atau diukur, bukan perkiraan. Jangan lupa bahan kecil seperti minyak, saus, topping, dan garnish.",
          },
          {
            title: "Ubah harga kemasan jadi harga per gram atau per ml",
            text: "Pakai harga nota terbaru dari pemasok. Harga telur, minyak, dan susu sering berubah.",
          },
          {
            title: "Bagi dengan porsi yang benar-benar terjual",
            text: "Kalau ada bahan terbuang saat diolah, hitung porsi yang bisa dijual, bukan porsi di atas kertas.",
          },
          {
            title: "Tambahkan kemasan",
            text: "Cup, tutup, sedotan, boks, dan kantong adalah biaya bahan juga untuk pesanan bawa pulang atau pesanan online.",
          },
          {
            title: "Bagi dengan target food cost",
            text: "Hasilnya harga jual minimum. Bulatkan ke harga yang enak dilihat, lalu cek lagi food cost-nya.",
          },
        ],
      },
      { type: "h2", text: "Berapa food cost yang wajar?" },
      {
        type: "p",
        text: "Tidak ada angka yang berlaku untuk semua usaha. Sebagai patokan umum, food cost sering berada di kisaran 25-35% dari harga jual. Minuman biasanya lebih rendah, menu dengan daging atau seafood lebih tinggi. Yang penting, margin kotor cukup untuk menutup gaji, sewa, dan biaya lain.",
      },
      { type: "h2", text: "HPP otomatis di Epidom" },
      {
        type: "p",
        text: "Menghitung manual benar untuk hari ini, tetapi harus diulang setiap harga bahan naik. Di paket Operations Epidom, Anda membuat resep sekali dengan takarannya. HPP tiap menu dihitung otomatis dari harga bahan, dan stok bahan berkurang setiap ada penjualan.",
      },
      {
        type: "list",
        items: [
          "Katalog bahan dengan harga yang bisa Anda perbarui",
          "Resep dengan takaran dan HPP per menu yang dihitung otomatis",
          "Stok berkurang saat pesanan selesai, dengan peringatan stok menipis",
          "Margin per item dan laba kotor di laporan keuangan",
        ],
      },
      {
        type: "p",
        text: "Paket Operations Rp 459.000 per bulan (Rp 379.000 per bulan untuk langganan tahunan), sudah termasuk paket POS.",
      },
    ],
    faqs: [
      {
        q: "Bagaimana cara menghitung HPP makanan?",
        a: "Jumlahkan biaya semua bahan yang dipakai (harga kemasan ÷ isi kemasan × jumlah dipakai), bagi dengan jumlah porsi, lalu tambahkan biaya kemasan per porsi. Hasilnya adalah HPP per porsi.",
      },
      {
        q: "Apa bedanya HPP dan food cost?",
        a: "HPP adalah biaya bahan (dan kemasan) untuk satu porsi dalam rupiah. Food cost adalah HPP itu dinyatakan sebagai persentase dari harga jual. HPP Rp 7.150 pada harga Rp 22.000 berarti food cost 32,5%.",
      },
      {
        q: "Bagaimana cara menentukan harga jual dari HPP?",
        a: "Bagi HPP per porsi dengan target food cost. HPP Rp 7.150 dan target 30% menghasilkan harga sekitar Rp 23.800. Setelah itu bulatkan dan cek margin akhirnya.",
      },
      {
        q: "Berapa food cost yang ideal untuk kafe?",
        a: "Patokan umumnya 25-35% dari harga jual, tetapi tergantung jenis menu dan biaya lain Anda. Pantau food cost per menu, bukan hanya rata-rata, supaya menu yang boros cepat terlihat.",
      },
      {
        q: "Berapa biaya HPP otomatis di Epidom?",
        a: "Fitur ini ada di paket Operations: Rp 459.000 per bulan (Rp 379.000 per bulan jika tahunan), sudah termasuk POS. Kalkulator di halaman ini gratis tanpa daftar.",
      },
    ],
    cta: {
      title: "Biarkan HPP dihitung otomatis",
      text: "Di paket Operations, HPP tiap menu ikut berubah saat harga bahan berubah, dan stok berkurang sesuai penjualan Anda.",
      button: "Lihat paket →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "recipe-cost-calculator",
    locale: "en",
    group: "recipe-cost",
    kind: "tool",
    tool: "recipe-cost",
    metaTitle: "Recipe Cost Calculator: Food Cost and Menu Price",
    metaDescription:
      "Recipe cost calculator: enter ingredients and pack prices to get cost per portion, the price for your target food cost percentage, and your margin.",
    eyebrow: "Free calculator",
    h1: "Recipe cost calculator: food cost and how to price a menu item",
    lede: "Your recipe cost is what the ingredients and packaging for one portion cost you. Use the calculator below to get it, and the menu price that hits your target food cost percentage.",
    blocks: [
      { type: "h2", text: "What the calculator does" },
      {
        type: "p",
        text: "For each ingredient, enter the pack price, the pack size and the quantity the recipe uses. Add the number of portions, the packaging per portion and the food cost percentage you are aiming for. If you already have a menu price, enter it to see your actual food cost and gross margin.",
      },
      { type: "tool" },
      { type: "h2", text: "The food cost formula" },
      {
        type: "p",
        text: "Every ingredient is worked out the same way: pack price divided by pack size, times the amount used. Add them up, divide by the number of portions, then add the packaging for one portion.",
      },
      {
        type: "callout",
        text: "Ingredient cost = (pack price ÷ pack size) × quantity used. Cost per portion = (total ingredients ÷ portions) + packaging. Menu price = cost per portion ÷ target food cost %. Food cost % = cost per portion ÷ menu price.",
      },
      { type: "h2", text: "Worked example: a cappuccino" },
      {
        type: "p",
        text: "One cappuccino uses 18 g of coffee beans (a 1 kg bag at $24, so $0.43), 200 ml of milk (1 liter at $1.20, so $0.24) and a cup with lid at $0.15. The cost per drink is about $0.82.",
      },
      {
        type: "p",
        text: "With a 30% target, the price to charge is 0.82 ÷ 0.30, about $2.74. Selling it at $4.00 gives a food cost of 20.6% and a gross margin of $3.18 per cup, or 79.4%. That margin still has to pay for rent, wages and utilities, because the calculation only covers ingredients and packaging.",
      },
      { type: "h2", text: "How to price a menu item" },
      {
        type: "steps",
        items: [
          {
            title: "Write down the standard recipe",
            text: "Use weighed or measured quantities, not guesses. Include small items: oil, sauce, toppings, garnish.",
          },
          {
            title: "Turn pack prices into a price per gram or ounce",
            text: "Use your latest supplier invoice. Dairy, eggs and coffee move more than you expect.",
          },
          {
            title: "Divide by the portions you actually sell",
            text: "If a batch loses product to trimming or cooking, count the portions that reach the customer, not the ones on paper.",
          },
          {
            title: "Add packaging",
            text: "Cups, lids, boxes and bags are a real cost on every takeaway and delivery order.",
          },
          {
            title: "Divide by your target food cost percentage",
            text: "That is your minimum price. Round to a clean menu price, then check the percentage it gives.",
          },
        ],
      },
      { type: "h2", text: "What food cost percentage should you aim for?" },
      {
        type: "p",
        text: "There is no universal number. A common rule of thumb puts food cost at roughly 25 to 35% of the menu price. Coffee and other drinks usually sit lower, and dishes built on meat or seafood run higher. What matters is that your gross margin covers labor, rent and everything else.",
      },
      { type: "h2", text: "When a spreadsheet stops being enough: automatic costing in Epidom" },
      {
        type: "p",
        text: "A manual calculation is right on the day you do it. When the price of milk changes, you have to redo it. With Epidom's Operations plan you build the recipe once with its quantities. The cost per dish is calculated automatically from your ingredient prices, and stock is deducted on each sale.",
      },
      {
        type: "list",
        items: [
          "An ingredient catalog with prices you update as you buy",
          "Recipes with quantities and a cost per dish worked out for you",
          "Stock deducted when orders complete, with low-stock alerts",
          "Item margin and gross margin in the finance reports",
        ],
      },
      {
        type: "p",
        text: "Operations is $29.99 per month ($24.99 per month billed yearly) and includes the POS plan.",
      },
    ],
    faqs: [
      {
        q: "How do you calculate the cost of a recipe?",
        a: "Add up the cost of each ingredient used (pack price ÷ pack size × quantity used), divide by the number of portions, then add the packaging for one portion. The result is your cost per portion.",
      },
      {
        q: "How do you calculate food cost percentage?",
        a: "Divide the cost per portion by the menu price and multiply by 100. A $0.82 cappuccino sold at $4.00 has a food cost of 20.6%.",
      },
      {
        q: "How do you price a menu item from its cost?",
        a: "Divide the cost per portion by your target food cost percentage. A $3.00 dish with a 30% target should be priced around $10.00. Then adjust for what your customers will pay and for your market.",
      },
      {
        q: "What is a good food cost percentage?",
        a: "A common rule of thumb is 25 to 35% of the menu price, but it depends on the type of business and the item. Track it dish by dish, because an average hides the items that lose you money.",
      },
      {
        q: "How much does automatic recipe costing cost in Epidom?",
        a: "It is part of the Operations plan: $29.99 per month ($24.99 per month billed yearly), which includes POS. The calculator on this page is free and needs no sign-up.",
      },
    ],
    cta: {
      title: "Let the cost per dish update itself",
      text: "On the Operations plan, every recipe re-costs when an ingredient price changes, and stock follows your sales.",
      button: "See the plans →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "recipe-cost-calculator-th",
    locale: "th",
    group: "recipe-cost",
    kind: "tool",
    tool: "recipe-cost",
    metaTitle: "เครื่องคำนวณต้นทุนสูตรอาหาร และราคาขายเมนู",
    metaDescription:
      "เครื่องคำนวณต้นทุนสูตรอาหาร: กรอกวัตถุดิบและราคาแพ็ก เพื่อดูต้นทุนต่อที่ ราคาขายตามเป้าหมายต้นทุนอาหาร และอัตรากำไรของเมนู",
    eyebrow: "เครื่องคำนวณฟรี",
    h1: "เครื่องคำนวณต้นทุนสูตรอาหาร: ต้นทุนอาหารและวิธีตั้งราคาเมนู",
    lede: "ต้นทุนสูตรอาหารคือค่าวัตถุดิบและบรรจุภัณฑ์ของหนึ่งที่ ใช้เครื่องคำนวณด้านล่างเพื่อหาต้นทุนนั้น และราคาเมนูที่ได้ตามเป้าหมายเปอร์เซ็นต์ต้นทุนอาหารของคุณ",
    blocks: [
      { type: "h2", text: "เครื่องคำนวณทำอะไรได้บ้าง" },
      {
        type: "p",
        text: "ในวัตถุดิบแต่ละรายการ ให้กรอกราคาแพ็ก ขนาดแพ็ก และปริมาณที่สูตรใช้ จากนั้นเพิ่มจำนวนเสิร์ฟ บรรจุภัณฑ์ต่อที่ และเปอร์เซ็นต์ต้นทุนอาหารที่คุณตั้งเป้าไว้ หากมีราคาเมนูอยู่แล้ว ให้กรอกเพื่อดูต้นทุนอาหารและกำไรขั้นต้นที่เป็นจริง",
      },
      { type: "tool" },
      { type: "h2", text: "สูตรคำนวณต้นทุนอาหาร" },
      {
        type: "p",
        text: "วัตถุดิบทุกรายการคำนวณด้วยวิธีเดียวกัน คือ ราคาแพ็กหารด้วยขนาดแพ็ก คูณด้วยปริมาณที่ใช้ นำมารวมกันทั้งหมด หารด้วยจำนวนเสิร์ฟ แล้วบวกบรรจุภัณฑ์ของหนึ่งที่",
      },
      {
        type: "callout",
        text: "ต้นทุนวัตถุดิบ = (ราคาแพ็ก ÷ ขนาดแพ็ก) × ปริมาณที่ใช้ ต้นทุนต่อที่ = (วัตถุดิบรวม ÷ จำนวนเสิร์ฟ) + บรรจุภัณฑ์ ราคาเมนู = ต้นทุนต่อที่ ÷ เปอร์เซ็นต์ต้นทุนอาหารเป้าหมาย เปอร์เซ็นต์ต้นทุนอาหาร = ต้นทุนต่อที่ ÷ ราคาเมนู",
      },
      { type: "h2", text: "ตัวอย่างการคำนวณ: คาปูชิโน" },
      {
        type: "p",
        text: "คาปูชิโนหนึ่งแก้วใช้เมล็ดกาแฟ 18 g (ถุง 1 kg ราคา $24 เท่ากับ $0.43) นม 200 ml (1 ลิตร ราคา $1.20 เท่ากับ $0.24) และแก้วพร้อมฝา $0.15 ต้นทุนต่อเครื่องดื่มอยู่ที่ประมาณ $0.82",
      },
      {
        type: "p",
        text: "หากตั้งเป้า 30% ราคาที่ควรขายคือ 0.82 ÷ 0.30 หรือประมาณ $2.74 ถ้าขายที่ $4.00 จะได้ต้นทุนอาหาร 20.6% และกำไรขั้นต้น $3.18 ต่อแก้ว หรือ 79.4% กำไรส่วนนี้ยังต้องนำไปจ่ายค่าเช่า ค่าแรง และค่าสาธารณูปโภค เพราะการคำนวณนี้รวมเพียงวัตถุดิบและบรรจุภัณฑ์",
      },
      { type: "h2", text: "วิธีตั้งราคาเมนู" },
      {
        type: "steps",
        items: [
          {
            title: "จดสูตรมาตรฐาน",
            text: "ใช้ปริมาณที่ชั่งหรือตวงจริง ไม่ใช่การเดา และรวมของเล็กๆ น้อยๆ ด้วย เช่น น้ำมัน ซอส ท็อปปิ้ง และเครื่องตกแต่ง",
          },
          {
            title: "แปลงราคาแพ็กเป็นราคาต่อกรัมหรือต่อออนซ์",
            text: "ใช้ราคาจากใบแจ้งหนี้ล่าสุดของซัพพลายเออร์ ผลิตภัณฑ์นม ไข่ และกาแฟ ราคาขยับมากกว่าที่คิด",
          },
          {
            title: "หารด้วยจำนวนที่ขายได้จริง",
            text: "หากล็อตหนึ่งสูญเสียวัตถุดิบจากการตัดแต่งหรือการปรุง ให้นับเฉพาะจำนวนที่ถึงมือลูกค้า ไม่ใช่จำนวนบนกระดาษ",
          },
          {
            title: "บวกบรรจุภัณฑ์",
            text: "แก้ว ฝา กล่อง และถุง เป็นต้นทุนจริงของทุกออเดอร์กลับบ้านและเดลิเวอรี",
          },
          {
            title: "หารด้วยเปอร์เซ็นต์ต้นทุนอาหารเป้าหมาย",
            text: "นั่นคือราคาขั้นต่ำของคุณ ปัดเป็นราคาเมนูที่ลงตัว แล้วตรวจดูว่าได้เปอร์เซ็นต์เท่าไร",
          },
        ],
      },
      { type: "h2", text: "ควรตั้งเป้าต้นทุนอาหารที่กี่เปอร์เซ็นต์" },
      {
        type: "p",
        text: "ไม่มีตัวเลขสากลที่ใช้ได้กับทุกร้าน หลักคร่าวๆ ที่พบบ่อยคือต้นทุนอาหารอยู่ราว 25 ถึง 35% ของราคาเมนู กาแฟและเครื่องดื่มอื่นๆ มักต่ำกว่า ส่วนจานที่ใช้เนื้อสัตว์หรืออาหารทะเลเป็นหลักจะสูงกว่า สิ่งสำคัญคือกำไรขั้นต้นของคุณต้องครอบคลุมค่าแรง ค่าเช่า และค่าใช้จ่ายอื่นทั้งหมด",
      },
      {
        type: "h2",
        text: "เมื่อสเปรดชีตไม่พออีกต่อไป: คิดต้นทุนอัตโนมัติใน Epidom",
      },
      {
        type: "p",
        text: "การคำนวณด้วยมือถูกต้องเฉพาะวันที่คุณทำ เมื่อราคานมเปลี่ยน คุณต้องคำนวณใหม่ แต่กับแพ็กเกจ Operations ของ Epidom คุณสร้างสูตรพร้อมปริมาณเพียงครั้งเดียว ต้นทุนต่อจานจะคำนวณอัตโนมัติจากราคาวัตถุดิบของคุณ และสต็อกจะถูกตัดทุกครั้งที่ขาย",
      },
      {
        type: "list",
        items: [
          "แคตตาล็อกวัตถุดิบพร้อมราคาที่คุณอัปเดตเมื่อซื้อของ",
          "สูตรพร้อมปริมาณ และต้นทุนต่อจานที่คำนวณให้",
          "ตัดสต็อกเมื่อออเดอร์เสร็จสมบูรณ์ พร้อมการแจ้งเตือนสต็อกใกล้หมด",
          "อัตรากำไรรายเมนูและกำไรขั้นต้นในรายงานการเงิน",
        ],
      },
      {
        type: "p",
        text: "แพ็กเกจ Operations ราคา $29.99 ต่อเดือน ($24.99 ต่อเดือน เมื่อชำระรายปี) และรวมแพ็กเกจ POS ไว้แล้ว",
      },
    ],
    faqs: [
      {
        q: "คำนวณต้นทุนสูตรอาหารอย่างไร",
        a: "รวมต้นทุนของวัตถุดิบแต่ละรายการที่ใช้ (ราคาแพ็ก ÷ ขนาดแพ็ก × ปริมาณที่ใช้) หารด้วยจำนวนเสิร์ฟ แล้วบวกบรรจุภัณฑ์ของหนึ่งที่ ผลลัพธ์คือต้นทุนต่อที่ของคุณ",
      },
      {
        q: "คำนวณเปอร์เซ็นต์ต้นทุนอาหารอย่างไร",
        a: "นำต้นทุนต่อที่หารด้วยราคาเมนู แล้วคูณ 100 คาปูชิโนต้นทุน $0.82 ที่ขาย $4.00 มีต้นทุนอาหาร 20.6%",
      },
      {
        q: "ตั้งราคาเมนูจากต้นทุนอย่างไร",
        a: "นำต้นทุนต่อที่หารด้วยเปอร์เซ็นต์ต้นทุนอาหารเป้าหมาย จานที่ต้นทุน $3.00 และตั้งเป้า 30% ควรตั้งราคาประมาณ $10.00 จากนั้นปรับตามราคาที่ลูกค้ายอมจ่ายและตลาดของคุณ",
      },
      {
        q: "เปอร์เซ็นต์ต้นทุนอาหารที่ดีคือเท่าไร",
        a: "หลักคร่าวๆ ที่พบบ่อยคือ 25 ถึง 35% ของราคาเมนู แต่ขึ้นอยู่กับประเภทธุรกิจและรายการ ควรติดตามเป็นรายจาน เพราะค่าเฉลี่ยจะซ่อนเมนูที่ทำให้คุณขาดทุน",
      },
      {
        q: "การคิดต้นทุนสูตรอัตโนมัติใน Epidom ราคาเท่าไร",
        a: "รวมอยู่ในแพ็กเกจ Operations ราคา $29.99 ต่อเดือน ($24.99 ต่อเดือน เมื่อชำระรายปี) ซึ่งรวม POS ไว้ด้วย เครื่องคำนวณในหน้านี้ใช้ฟรีและไม่ต้องสมัครใช้งาน",
      },
    ],
    cta: {
      title: "ให้ต้นทุนต่อจานอัปเดตเอง",
      text: "ในแพ็กเกจ Operations ทุกสูตรจะคำนวณต้นทุนใหม่เมื่อราคาวัตถุดิบเปลี่ยน และสต็อกจะตามยอดขายของคุณ",
      button: "ดูแพ็กเกจ →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
];
