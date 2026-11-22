window.WAITLIST_MOCK = {
  wishlist: [
    { id: 1, name: 'Penny Cruiser 27"', image: 'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?auto=format&fit=crop&w=900&q=80', productUrl: 'https://www.pennyskateboards.com/', price: 109, originalPrice: 129, addedAt: '2026-07-03', wantCount: 6, status: 'waiting', collectionId: 'weekend', favorite: true, favoriteCount: 1, note: '想用来接驳公交，颜色也很喜欢。' },
    { id: 2, name: 'Matcha Starter Set', productUrl: 'https://ippodotea.com/', image: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=80', price: 42, originalPrice: 52, addedAt: '2026-07-12', wantCount: 3, status: 'waiting', collectionId: 'slow-home', favorite: false, favoriteCount: 0, note: '如果每天真的会用，就值得。' },
    { id: 3, name: 'Weekend Cabin Trip', productUrl: 'https://www.airbnb.com/', image: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=80', price: 280, originalPrice: 320, addedAt: '2026-06-28', wantCount: 8, status: 'waiting', collectionId: 'weekend', favorite: true, favoriteCount: 1, note: '比很多小东西更想要。' },
    { id: 4, name: 'Soft Leather Tote', productUrl: 'https://www.cuyana.com/', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80', price: 89, originalPrice: 120, addedAt: '2026-07-18', wantCount: 2, status: 'waiting', collectionId: 'everyday', favorite: false, favoriteCount: 0, note: '上班通勤可能会很实用。' },
    { id: 5, name: 'Linen Reading Chair', productUrl: 'https://www.article.com/', image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80', price: 340, originalPrice: 420, addedAt: '2026-07-20', wantCount: 4, status: 'waiting', collectionId: 'slow-home', favorite: true, favoriteCount: 1, note: '想留一个真正舒服的阅读角。' },
    { id: 6, name: 'Compact Film Camera', productUrl: 'https://www.fujifilm.com/', image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80', price: 129, originalPrice: 149, addedAt: '2026-07-21', wantCount: 5, status: 'waiting', collectionId: 'weekend', favorite: false, favoriteCount: 0, note: '旅行时少看手机，多记住一点。' },
    { id: 7, name: 'Hand-thrown Table Lamp', productUrl: 'https://www.ikea.com/', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80', price: 76, originalPrice: null, addedAt: '2026-07-23', wantCount: 2, status: 'waiting', collectionId: 'slow-home', favorite: false, favoriteCount: 0, note: '卧室需要一盏更温柔的灯。' },
    { id: 8, name: 'Everyday Sneakers', productUrl: 'https://www.newbalance.com/', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80', price: 118, originalPrice: 140, addedAt: '2026-07-25', wantCount: 3, status: 'waiting', collectionId: 'everyday', favorite: true, favoriteCount: 1, note: '如果能替代现在两双不舒服的鞋就值得。' }
  ],
  bought: [
    { id: 11, name: 'Noise-cancelling Headphones', productUrl: 'https://electronics.sony.com/audio/headphones/c/headband', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80', price: 179, date: '2026-06-10', wishlistDays: 32, wantCount: 7, status: 'bought', collectionId: 'everyday', favorite: true, favoriteCount: 1, satisfaction: 5, reflection: '每天通勤都在用，买得很值。' },
    { id: 12, name: 'Ceramic Mug', productUrl: 'https://www.heathceramics.com/collections/mugs-cups', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80', price: 24, date: '2026-05-22', wishlistDays: 9, wantCount: 3, status: 'bought', collectionId: 'slow-home', favorite: false, favoriteCount: 0, satisfaction: 4, reflection: '开心，但其实家里已经有杯子。' }
  ],
  letGo: [
    { id: 21, name: 'Limited Edition Sneakers', productUrl: 'https://www.nike.com/w/shoes-y7ok', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', price: 150, date: '2026-06-30', wishlistDays: 21, wantCount: 5, status: 'letGo', collectionId: 'everyday', favorite: false, favoriteCount: 0, saved: 150 },
    { id: 22, name: 'Mini Projector', productUrl: 'https://www.seenebula.com/collections/projectors', image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80', price: 99, date: '2026-05-19', wishlistDays: 44, wantCount: 2, status: 'letGo', collectionId: 'slow-home', favorite: true, favoriteCount: 1, saved: 99 }
  ],
  collections: [
    { id: 'weekend', name: 'Weekend away', description: 'Little escapes, open roads, and things that make leaving town easier.' },
    { id: 'slow-home', name: 'Slow home', description: 'Objects that make ordinary mornings feel more considered.' },
    { id: 'everyday', name: 'Everyday better', description: 'Useful upgrades worth thinking about twice.' }
  ],
  ultimate: { name: 'Yellowstone Road Trip', description: '四到五天，住园内或附近，慢慢看风景。', target: 1200, points: 438 },
  ultimateBuckets: [
    { id: 'general', name: 'General savings', description: 'Flexible savings for whatever comes next.', target: 1000, points: 249 },
    { id: 'yellowstone', name: 'Yellowstone Road Trip', description: 'Four slow days and open roads.', target: 1200, points: 438 },
    { id: 'kyoto', name: 'Kyoto Autumn Trip', description: 'A quiet week during maple season.', target: 1800, points: 180 },
    { id: 'studio', name: 'Home Studio', description: 'A focused space for making things.', target: 750, points: 95 }
  ]
};
