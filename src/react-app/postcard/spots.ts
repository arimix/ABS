// Sample data for the postcard prototype. Names are fictional; coordinates
// are approximate street corners in each neighborhood.

export interface Spot {
  id: string;
  name: string;
  emoji: string;
  cuisine: string;
  price: string;
  rating: number;
  note: string;
  lng: number;
  lat: number;
}

export interface Neighborhood {
  id: string;
  name: string;
  city: string;
  spots: Spot[];
}

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: "mission",
    name: "The Mission",
    city: "San Francisco",
    spots: [
      { id: "m1", name: "Bar Mariposa", emoji: "🍸", cuisine: "Cocktails", price: "$$", rating: 4.6, note: "Start with the hibiscus spritz", lng: -122.422, lat: 37.765 },
      { id: "m2", name: "Moonlight Noodle Bar", emoji: "🍜", cuisine: "Ramen", price: "$$", rating: 4.7, note: "Spicy miso, extra egg", lng: -122.4219, lat: 37.7634 },
      { id: "m3", name: "Dolores Gelato", emoji: "🍦", cuisine: "Dessert", price: "$", rating: 4.8, note: "Eat it in the park at sunset", lng: -122.4258, lat: 37.7614 },
      { id: "m4", name: "Saffron Alley", emoji: "🍛", cuisine: "Indian", price: "$$", rating: 4.5, note: "Share the thali for two", lng: -122.4215, lat: 37.7587 },
      { id: "m5", name: "Sourdough Social", emoji: "🥐", cuisine: "Bakery café", price: "$", rating: 4.6, note: "Morning bun, no regrets", lng: -122.4232, lat: 37.7553 },
      { id: "m6", name: "Tacos La Paloma", emoji: "🌮", cuisine: "Mexican", price: "$", rating: 4.9, note: "Al pastor off the trompo", lng: -122.4183, lat: 37.7524 },
    ],
  },
  {
    id: "west-village",
    name: "West Village",
    city: "New York",
    spots: [
      { id: "w1", name: "Jane's Dumpling Club", emoji: "🥟", cuisine: "Dumplings", price: "$", rating: 4.6, note: "Pork & chive, chili crisp", lng: -74.0042, lat: 40.7383 },
      { id: "w2", name: "Perry Street Pie", emoji: "🍕", cuisine: "Pizza", price: "$", rating: 4.7, note: "Grandma slice, always", lng: -74.0045, lat: 40.7357 },
      { id: "w3", name: "Hudson Oyster Room", emoji: "🦪", cuisine: "Seafood", price: "$$$", rating: 4.5, note: "Happy hour buck-a-shuck", lng: -74.0067, lat: 40.7334 },
      { id: "w4", name: "Grove St. Bagels", emoji: "🥯", cuisine: "Bagels", price: "$", rating: 4.8, note: "Everything, scallion schmear", lng: -74.0035, lat: 40.7329 },
      { id: "w5", name: "The Corner Negroni", emoji: "🍹", cuisine: "Wine bar", price: "$$", rating: 4.4, note: "Sit at the window", lng: -74.005, lat: 40.7315 },
      { id: "w6", name: "Little Fig Trattoria", emoji: "🍝", cuisine: "Italian", price: "$$", rating: 4.7, note: "Cacio e pepe for the table", lng: -74.0027, lat: 40.7305 },
    ],
  },
  {
    id: "shoreditch",
    name: "Shoreditch",
    city: "London",
    spots: [
      { id: "s1", name: "Hoxton Square Pizza", emoji: "🍕", cuisine: "Pizza", price: "££", rating: 4.5, note: "Nduja & hot honey", lng: -0.0825, lat: 51.5278 },
      { id: "s2", name: "Boxpark Bao", emoji: "🥟", cuisine: "Taiwanese", price: "£", rating: 4.6, note: "Fried chicken bao", lng: -0.0773, lat: 51.5235 },
      { id: "s3", name: "Redchurch Wine Rooms", emoji: "🍷", cuisine: "Natural wine", price: "££", rating: 4.4, note: "Ask for the orange pét-nat", lng: -0.075, lat: 51.524 },
      { id: "s4", name: "Brick Lane Bagel Co.", emoji: "🥯", cuisine: "Bagels", price: "£", rating: 4.8, note: "Salt beef, extra mustard", lng: -0.0718, lat: 51.5246 },
      { id: "s5", name: "Curry Mile Canteen", emoji: "🍛", cuisine: "Bangladeshi", price: "£", rating: 4.5, note: "Lamb bhuna & garlic naan", lng: -0.0716, lat: 51.5207 },
      { id: "s6", name: "Columbia Road Café", emoji: "☕", cuisine: "Café", price: "£", rating: 4.7, note: "Sunday flower market coffee", lng: -0.07, lat: 51.5292 },
    ],
  },
];
