import { network } from "hardhat";
import { ethers } from "ethers";
const hardhatEthersPromise = network.connect().then((connection) => connection.ethers);

// Complete 193 UN Member Countries List
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

// Continents (6)
const CONTINENTS_6 = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];

// Indian States & UTs (37)
const INDIAN_37_STATES = [
  'Telangana', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep',
  'Puducherry', 'Central Territory Zone'
];

// Telangana Districts (33)
const TELANGANA_33_DISTRICTS = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
  'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
  'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet',
  'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy',
  'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy',
  'Warangal', 'Hanamkonda', 'Yadadri Bhuvanagiri'
];

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function main() {
  const ethers = await hardhatEthersPromise;
  console.log("==================================================");
  console.log("ABCDeFI Legion NFT — Full Ecosystem Deployment");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Wallet:", deployer.address);

  // Deploy LegionNFT Contract
  const LegionNFTFactory = await ethers.getContractFactory("LegionNFT");
  const legionNFT = await LegionNFTFactory.deploy(deployer.address, deployer.address);
  await legionNFT.waitForDeployment();
  const address = await legionNFT.getAddress();
  console.log(`\n✅ LegionNFT Deployed at: ${address}`);

  // Step 17: Mint 6 Continents
  console.log("\nMinting 6 Continents...");
  let asiaId = 1;
  for (let i = 0; i < CONTINENTS_6.length; i++) {
    const cName = CONTINENTS_6[i];
    const tx = await legionNFT.mintContinent(
      deployer.address,
      cName,
      `${cName} Continent`,
      "Supreme Guardian",
      `ipfs://QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/continents/${slugify(cName)}.json`,
      500000000 + i * 200000000,
      500
    );
    await tx.wait();
  }
  console.log("✅ 6 Continents Minted (Asia #1 to Oceania #6)");

  // Step 18: Mint 193 Countries
  console.log("\nMinting 193 Countries...");
  const countryNames: string[] = [];
  const countryTerritories: string[] = [];
  const parentContinentIds: number[] = [];
  const countryCharacters: string[] = [];
  const countryURIs: string[] = [];
  const countryPopulations: number[] = [];
  const countryBps: number[] = [];

  for (let i = 0; i < ALL_193_COUNTRIES.length; i++) {
    const country = ALL_193_COUNTRIES[i];
    const parentId = country === "India" ? asiaId : (i % 6) + 1;
    countryNames.push(country);
    countryTerritories.push(`${country} Territory`);
    parentContinentIds.push(parentId);
    countryCharacters.push("Vanguard Commander");
    countryURIs.push(`ipfs://QmY3b1aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9c/countries/${slugify(country)}.json`);
    countryPopulations.push(10000000 + ((i * 37) % 500000000));
    countryBps.push(300);
  }

  for (let i = 0; i < countryNames.length; i += 50) {
    const tx = await legionNFT.batchMintCountry(
      deployer.address,
      countryNames.slice(i, i + 50),
      countryTerritories.slice(i, i + 50),
      parentContinentIds.slice(i, i + 50),
      countryCharacters.slice(i, i + 50),
      countryURIs.slice(i, i + 50),
      countryPopulations.slice(i, i + 50),
      countryBps.slice(i, i + 50)
    );
    await tx.wait();
  }
  console.log("✅ 193 Countries Minted");

  let indiaId = 12;

  // Step 19: Mint 37 States
  console.log("\nMinting 37 States...");
  const stateNames = INDIAN_37_STATES;
  const stateTerritories = stateNames.map((s) => `${s} State`);
  const parentCountryIds = stateNames.map(() => indiaId);
  const stateCharacters = stateNames.map(() => "Regional Warlord");
  const stateURIs = stateNames.map((s) => `ipfs://QmZ9c4aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9d/states/${slugify(s)}.json`);
  const statePopulations = stateNames.map((_, i) => 20000000 + i * 1000000);
  const stateBps = stateNames.map(() => 150);

  const txState = await legionNFT.batchMintState(
    deployer.address,
    stateNames,
    stateTerritories,
    parentCountryIds,
    stateCharacters,
    stateURIs,
    statePopulations,
    stateBps
  );
  await txState.wait();
  console.log("✅ 37 States Minted");

  let telanganaId = 200;

  // Step 20: Mint 33 Telangana Districts
  console.log("\nMinting 33 Telangana Districts...");
  const dNames = TELANGANA_33_DISTRICTS;
  const dTerritories = dNames.map((d) => `${d} District`);
  const parentStateIds = dNames.map(() => telanganaId);
  const dCharacters = dNames.map(() => "District Knight");
  const dURIs = dNames.map((d) => `ipfs://QmA2d5aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9e/districts/${slugify(d)}.json`);
  const dPopulations = dNames.map((_, i) => 1000000 + i * 100000);
  const dBps = dNames.map(() => 50);

  const txDistrict = await legionNFT.batchMintDistrict(
    deployer.address,
    dNames,
    dTerritories,
    parentStateIds,
    dCharacters,
    dURIs,
    dPopulations,
    dBps
  );
  await txDistrict.wait();
  console.log("✅ 33 Telangana Districts Minted");

  // PHASE 10 STATISTICS SUMMARY
  const totalMinted = await legionNFT.totalLegions();
  console.log("\n==================================================");
  console.log("PHASE 10 STATISTICS SUMMARY");
  console.log("==================================================");
  console.log(`Continents: 6`);
  console.log(`Countries:  193`);
  console.log(`States:     37`);
  console.log(`Districts:  33`);
  console.log(`TOTAL NFTS: ${totalMinted}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
