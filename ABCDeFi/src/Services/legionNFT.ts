// ==========================================
// Legion NFT Ecosystem - Complete Dataset & Service
// Continents (6) → Countries (193) → States (37) → Districts (33)
// ==========================================

export enum NFTLevel {
  Continent = 0,
  Country = 1,
  State = 2,
  District = 3,
}

export const NFTLevelNames: Record<NFTLevel, string> = {
  [NFTLevel.Continent]: 'Continent',
  [NFTLevel.Country]: 'Country',
  [NFTLevel.State]: 'State',
  [NFTLevel.District]: 'District',
};

export const NFTLevelIcons: Record<NFTLevel, string> = {
  [NFTLevel.Continent]: '🌍',
  [NFTLevel.Country]: '🏳️',
  [NFTLevel.State]: '🏛️',
  [NFTLevel.District]: '📍',
};

export interface LegionNFTMetadata {
  nftId: number;
  name: string;
  territory: string;
  level: NFTLevel;
  parentId: number; // 0 for Continent, else parent NFT ID
  character: string;
  metadataURI: string;
  population: number;
  treasuryShareBps: number;
  createdAt: string;
  owner: string;
  imageSlug: string;
}

export const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Step 17: 6 Continents List
export const CONTINENTS_6 = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];

// Step 18: 193 UN Member Countries List
export const ALL_193_COUNTRIES: string[] = [
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

// Step 19: 37 Indian States & UTs
export const INDIAN_37_STATES = [
  'Telangana', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep',
  'Puducherry', 'Central Territory Zone'
];

// Step 20: 33 Telangana Districts
export const TELANGANA_33_DISTRICTS = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
  'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
  'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet',
  'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy',
  'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy',
  'Warangal', 'Hanamkonda', 'Yadadri Bhuvanagiri'
];

// Build complete 269 Legion NFTs Dataset preserving Phase 6 Hierarchy
export const buildLegionDataset = (): LegionNFTMetadata[] => {
  const nfts: LegionNFTMetadata[] = [];

  // Step 17: 6 Continents (IDs 1 to 6)
  CONTINENTS_6.forEach((cName, idx) => {
    nfts.push({
      nftId: idx + 1,
      name: cName,
      territory: `${cName} Continent`,
      level: NFTLevel.Continent,
      parentId: 0,
      character: 'Supreme Guardian',
      metadataURI: `ipfs://QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/continents/${slugify(cName)}.json`,
      population: 500000000 + idx * 200000000,
      treasuryShareBps: 500,
      createdAt: '2026-01-01',
      owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      imageSlug: slugify(cName),
    });
  });

  const asiaId = 1;

  // Step 18: 193 Countries (IDs 7 to 199)
  let indiaId = 12; // India will be ID 12
  ALL_193_COUNTRIES.forEach((cName, idx) => {
    const parentId = cName === 'India' ? asiaId : (idx % 6) + 1;
    const nftId = idx + 7;
    if (cName === 'India') indiaId = nftId;

    nfts.push({
      nftId,
      name: cName,
      territory: `${cName} Territory`,
      level: NFTLevel.Country,
      parentId,
      character: 'Vanguard Commander',
      metadataURI: `ipfs://QmY3b1aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9c/countries/${slugify(cName)}.json`,
      population: 10000000 + ((idx * 37) % 500000000),
      treasuryShareBps: 300,
      createdAt: '2026-02-01',
      owner: '0x3C44CdD46a9380a46014605930064d7879e96f13',
      imageSlug: slugify(cName),
    });
  });

  // Step 19: 37 States under India (IDs 200 to 236)
  let telanganaId = 200;
  INDIAN_37_STATES.forEach((sName, idx) => {
    const nftId = 200 + idx;
    if (sName === 'Telangana') telanganaId = nftId;

    nfts.push({
      nftId,
      name: sName,
      territory: `${sName} State`,
      level: NFTLevel.State,
      parentId: indiaId,
      character: 'Regional Warlord',
      metadataURI: `ipfs://QmZ9c4aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9d/states/${slugify(sName)}.json`,
      population: 20000000 + idx * 1000000,
      treasuryShareBps: 150,
      createdAt: '2026-02-15',
      owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      imageSlug: slugify(sName),
    });
  });

  // Step 20: 33 Telangana Districts under Telangana (IDs 237 to 269)
  TELANGANA_33_DISTRICTS.forEach((dName, idx) => {
    const nftId = 237 + idx;
    nfts.push({
      nftId,
      name: dName,
      territory: `${dName} District`,
      level: NFTLevel.District,
      parentId: telanganaId,
      character: 'District Knight',
      metadataURI: `ipfs://QmA2d5aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9e/districts/${slugify(dName)}.json`,
      population: 1000000 + idx * 100000,
      treasuryShareBps: 50,
      createdAt: '2026-03-01',
      owner: '0x15d34AA54267DB7D7c367839AAf71A00a2C6A65E',
      imageSlug: slugify(dName),
    });
  });

  return nfts;
};

export const MOCK_LEGION_NFTS: LegionNFTMetadata[] = buildLegionDataset();
