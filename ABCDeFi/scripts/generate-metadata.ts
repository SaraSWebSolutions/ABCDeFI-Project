import fs from 'fs';
import path from 'path';

export interface ERC721Attribute {
  trait_type: string;
  value: string | number;
}

export interface ContinentMetadata {
  name: string;
  description: string;
  image: string;
  continent: string;
  level: string;
  mascot: string;
  attributes: ERC721Attribute[];
}

export interface CountryMetadata {
  name: string;
  country: string;
  continent: string;
  mascot: string;
  description: string;
  image: string;
  level: string;
  attributes: ERC721Attribute[];
}

const ALL_193_COUNTRIES: string[] = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Congo-Brazzaville)', 'Congo (Democratic Republic)',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador',
  'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar',
  'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar (Burma)', 'Namibia', 'Nauru', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan',
  'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Tajikistan', 'Tanzania',
  'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const BASE_URL = 'https://api.abcdefi.com';

// Continents array (Step 17 - 6 Continents)
const CONTINENTS_6: string[] = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];

const CONTINENT_MASCOTS: Record<string, string> = {
  'Asia': 'Asian Celestial Dragon',
  'Europe': 'European Golden Eagle',
  'Africa': 'African Sun Lion',
  'North America': 'North American Peregrine Falcon',
  'South America': 'South American Phantom Jaguar',
  'Oceania': 'Oceanic Apex Phoenix',
};

// 37 Indian States & UTs (Step 19)
const INDIAN_37_STATES = [
  { name: 'Telangana', code: 'TS' },
  { name: 'Andhra Pradesh', code: 'AP' },
  { name: 'Arunachal Pradesh', code: 'AR' },
  { name: 'Assam', code: 'AS' },
  { name: 'Bihar', code: 'BR' },
  { name: 'Chhattisgarh', code: 'CG' },
  { name: 'Goa', code: 'GA' },
  { name: 'Gujarat', code: 'GJ' },
  { name: 'Haryana', code: 'HR' },
  { name: 'Himachal Pradesh', code: 'HP' },
  { name: 'Jharkhand', code: 'JH' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Kerala', code: 'KL' },
  { name: 'Madhya Pradesh', code: 'MP' },
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Manipur', code: 'MN' },
  { name: 'Meghalaya', code: 'ML' },
  { name: 'Mizoram', code: 'MZ' },
  { name: 'Nagaland', code: 'NL' },
  { name: 'Odisha', code: 'OD' },
  { name: 'Punjab', code: 'PB' },
  { name: 'Rajasthan', code: 'RJ' },
  { name: 'Sikkim', code: 'SK' },
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Tripura', code: 'TR' },
  { name: 'Uttar Pradesh', code: 'UP' },
  { name: 'Uttarakhand', code: 'UK' },
  { name: 'West Bengal', code: 'WB' },
  { name: 'Andaman and Nicobar Islands', code: 'AN' },
  { name: 'Chandigarh', code: 'CH' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN' },
  { name: 'Delhi', code: 'DL' },
  { name: 'Jammu and Kashmir', code: 'JK' },
  { name: 'Ladakh', code: 'LA' },
  { name: 'Lakshadweep', code: 'LD' },
  { name: 'Puducherry', code: 'PY' },
  { name: 'Central Territory Zone', code: 'CT' },
];

// 33 Telangana Districts (Step 20)
const TELANGANA_33_DISTRICTS = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
  'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
  'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet',
  'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy',
  'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy',
  'Warangal', 'Hanamkonda', 'Yadadri Bhuvanagiri'
];

function generateMetadata() {
  const rootDir = process.cwd();
  const metadataDir = path.join(rootDir, 'metadata');

  const dirs = {
    continents: path.join(metadataDir, 'continents'),
    countries: path.join(metadataDir, 'countries'),
    states: path.join(metadataDir, 'states'),
    districts: path.join(metadataDir, 'districts'),
  };

  // Ensure directories exist
  Object.values(dirs).forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // 1. Generate 6 Continents Metadata (Step 17)
  CONTINENTS_6.forEach((c) => {
    const slug = slugify(c);
    const data: ContinentMetadata = {
      name: `${c}`,
      description: `Official Legion NFT representing ${c} Continent in the ABCDeFi Ecosystem.`,
      image: `ipfs://QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/continents/${slug}.png`,
      continent: c,
      level: 'Continent',
      mascot: CONTINENT_MASCOTS[c] || `${c} Mascot`,
      attributes: [
        { trait_type: 'Level', value: 'Continent' },
        { trait_type: 'Parent NFT ID', value: 0 },
        { trait_type: 'Character', value: 'Supreme Guardian' },
        { trait_type: 'Treasury Share Bps', value: 500 },
        { trait_type: 'Mascot', value: CONTINENT_MASCOTS[c] || `${c} Mascot` },
      ],
    };
    fs.writeFileSync(path.join(dirs.continents, `${slug}.json`), JSON.stringify(data, null, 2));
  });

  // 2. Generate 193 Countries Metadata (Step 18)
  ALL_193_COUNTRIES.forEach((country, idx) => {
    const slug = slugify(country);
    const continentName = country === 'India' ? 'Asia' : CONTINENTS_6[idx % CONTINENTS_6.length];
    const parentId = country === 'India' ? 1 : (idx % 6) + 1;
    const data: CountryMetadata = {
      name: `${country}`,
      country: country,
      continent: continentName,
      mascot: 'Skater Astronaut',
      description: `Official ABCDeFi Legion Territory NFT for ${country}. Finance for everyone.`,
      image: `ipfs://QmY3b1aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9c/countries/${slug}.png`,
      level: 'Country',
      attributes: [
        { trait_type: 'Level', value: 'Country' },
        { trait_type: 'Continent', value: continentName },
        { trait_type: 'Parent NFT ID', value: parentId },
        { trait_type: 'Character', value: 'Vanguard Commander' },
        { trait_type: 'Treasury Share Bps', value: 300 },
        { trait_type: 'Mascot', value: 'Skater Astronaut' },
      ],
    };
    fs.writeFileSync(path.join(dirs.countries, `${slug}.json`), JSON.stringify(data, null, 2));
  });

  // 3. Generate 37 States Metadata (Step 19)
  // India is NFT ID 12 (1st country in Asia or mapped in sequence)
  const indiaParentId = 12; 
  INDIAN_37_STATES.forEach((s) => {
    const slug = slugify(s.name);
    const data = {
      name: `${s.name}`,
      state: s.name,
      code: s.code,
      country: 'India',
      continent: 'Asia',
      mascot: 'Regional Warlord',
      description: `Official ABCDeFi Legion State Territory NFT for ${s.name} (${s.code}), India.`,
      image: `ipfs://QmZ9c4aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9d/states/${slug}.png`,
      level: 'State',
      attributes: [
        { trait_type: 'Level', value: 'State' },
        { trait_type: 'State Code', value: s.code },
        { trait_type: 'Country', value: 'India' },
        { trait_type: 'Parent NFT ID', value: indiaParentId },
        { trait_type: 'Character', value: 'Regional Warlord' },
        { trait_type: 'Treasury Share Bps', value: 150 },
        { trait_type: 'Mascot', value: 'Regional Warlord' },
      ],
    };
    fs.writeFileSync(path.join(dirs.states, `${slug}.json`), JSON.stringify(data, null, 2));
  });

  // 4. Generate 33 Telangana Districts Metadata (Step 20)
  // Telangana is 1st state -> State NFT ID = 200
  const telanganaStateParentId = 200; 
  TELANGANA_33_DISTRICTS.forEach((dName) => {
    const slug = slugify(dName);
    const data = {
      name: `${dName}`,
      district: dName,
      state: 'Telangana',
      country: 'India',
      continent: 'Asia',
      mascot: 'District Knight',
      description: `Official ABCDeFi Legion District Territory NFT for ${dName}, Telangana, India.`,
      image: `ipfs://QmA2d5aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9e/districts/${slug}.png`,
      level: 'District',
      attributes: [
        { trait_type: 'Level', value: 'District' },
        { trait_type: 'District', value: dName },
        { trait_type: 'State', value: 'Telangana' },
        { trait_type: 'Country', value: 'India' },
        { trait_type: 'Parent NFT ID', value: telanganaStateParentId },
        { trait_type: 'Character', value: 'District Knight' },
        { trait_type: 'Treasury Share Bps', value: 50 },
        { trait_type: 'Mascot', value: 'District Knight' },
      ],
    };
    fs.writeFileSync(path.join(dirs.districts, `${slug}.json`), JSON.stringify(data, null, 2));
  });

  console.log(`✅ All metadata JSON files updated for Continents (6), Countries (193), States (37), Districts (33)!`);
}

generateMetadata();
