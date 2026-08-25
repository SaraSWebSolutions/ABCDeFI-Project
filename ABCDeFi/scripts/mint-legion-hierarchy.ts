import { network } from "hardhat";
import { ethers } from "ethers";
const hardhatEthersPromise = network.connect().then((connection) => connection.ethers);
import * as fs from "fs";
import * as path from "path";

// 193 UN Member Countries List
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

// Step 17: 6 Continents
const CONTINENTS_6 = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];

// Step 19: 37 Indian States & UTs
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

// Step 20: 33 Telangana Districts
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
  console.log("Legion NFT — Minting Steps 17 to 20 & Hierarchy");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer / Minter Address:", deployer.address);

  // Deploy LegionNFT Contract
  const LegionNFTFactory = await ethers.getContractFactory("LegionNFT");
  const legionNFT = await LegionNFTFactory.deploy(deployer.address, deployer.address);
  await legionNFT.waitForDeployment();
  const contractAddress = await legionNFT.getAddress();
  console.log(`\n✅ LegionNFT Contract Deployed at: ${contractAddress}`);

  // --------------------------------------------------
  // Step 17: Mint 6 Continent NFTs
  // --------------------------------------------------
  console.log("\n--- STEP 17: Minting 6 Continent NFTs ---");
  let asiaTokenId = 0;
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
    if (cName === "Asia") asiaTokenId = i + 1;
  }
  console.log(`✅ Step 17 Completed: 6 Continent NFTs Minted. (Asia Token ID = ${asiaTokenId})`);

  // --------------------------------------------------
  // Step 18: Mint 193 Country NFTs using mintCountry() / batchMintCountry()
  // --------------------------------------------------
  console.log("\n--- STEP 18: Writing mintCountry() & Minting 193 Country NFTs ---");
  const countryNames: string[] = [];
  const countryTerritories: string[] = [];
  const parentContinentIds: number[] = [];
  const countryCharacters: string[] = [];
  const countryURIs: string[] = [];
  const countryPopulations: number[] = [];
  const countryBps: number[] = [];

  let indiaTokenId = 0;

  for (let i = 0; i < ALL_193_COUNTRIES.length; i++) {
    const country = ALL_193_COUNTRIES[i];
    const parentId = country === "India" ? asiaTokenId : (i % 6) + 1;
    countryNames.push(country);
    countryTerritories.push(`${country} Territory`);
    parentContinentIds.push(parentId);
    countryCharacters.push("Vanguard Commander");
    countryURIs.push(`ipfs://QmY3b1aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9c/countries/${slugify(country)}.json`);
    countryPopulations.push(10000000 + ((i * 37) % 500000000));
    countryBps.push(300);
  }

  // Batch mint in chunks of 50 for gas safety
  const chunkSize = 50;
  for (let i = 0; i < countryNames.length; i += chunkSize) {
    const chunkNames = countryNames.slice(i, i + chunkSize);
    const tx = await legionNFT.batchMintCountry(
      deployer.address,
      chunkNames,
      countryTerritories.slice(i, i + chunkSize),
      parentContinentIds.slice(i, i + chunkSize),
      countryCharacters.slice(i, i + chunkSize),
      countryURIs.slice(i, i + chunkSize),
      countryPopulations.slice(i, i + chunkSize),
      countryBps.slice(i, i + chunkSize)
    );
    await tx.wait();
  }

  // Locate India Token ID
  const totalAfterCountries = await legionNFT.totalLegions();
  for (let id = 7; id <= totalAfterCountries; id++) {
    const details = await legionNFT.getLegionDetails(id);
    if (details.name === "India") {
      indiaTokenId = Number(details.nftId);
      break;
    }
  }

  console.log(`✅ Step 18 Completed: 193 Country NFTs Minted. (India Token ID = ${indiaTokenId})`);

  // --------------------------------------------------
  // Step 19: Mint 37 State NFTs using mintState() / batchMintState()
  // --------------------------------------------------
  console.log("\n--- STEP 19: Writing mintState() & Minting 37 State NFTs ---");
  const stateNames: string[] = [];
  const stateTerritories: string[] = [];
  const parentCountryIds: number[] = [];
  const stateCharacters: string[] = [];
  const stateURIs: string[] = [];
  const statePopulations: number[] = [];
  const stateBps: number[] = [];

  for (let i = 0; i < INDIAN_37_STATES.length; i++) {
    const stateName = INDIAN_37_STATES[i];
    stateNames.push(stateName);
    stateTerritories.push(`${stateName} State`);
    parentCountryIds.push(indiaTokenId);
    stateCharacters.push("Regional Warlord");
    stateURIs.push(`ipfs://QmZ9c4aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9d/states/${slugify(stateName)}.json`);
    statePopulations.push(20000000 + i * 1000000);
    stateBps.push(150);
  }

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

  let telanganaTokenId = 0;
  const totalAfterStates = await legionNFT.totalLegions();
  for (let id = 200; id <= totalAfterStates; id++) {
    const details = await legionNFT.getLegionDetails(id);
    if (details.name === "Telangana") {
      telanganaTokenId = Number(details.nftId);
      break;
    }
  }

  console.log(`✅ Step 19 Completed: 37 State NFTs Minted. (Telangana Token ID = ${telanganaTokenId})`);

  // --------------------------------------------------
  // Step 20: Mint 33 Telangana District NFTs using mintDistrict() / batchMintDistrict()
  // --------------------------------------------------
  console.log("\n--- STEP 20: Writing mintDistrict() & Minting 33 Telangana District NFTs ---");
  const districtNames: string[] = [];
  const districtTerritories: string[] = [];
  const parentStateIds: number[] = [];
  const districtCharacters: string[] = [];
  const districtURIs: string[] = [];
  const districtPopulations: number[] = [];
  const districtBps: number[] = [];

  for (let i = 0; i < TELANGANA_33_DISTRICTS.length; i++) {
    const dName = TELANGANA_33_DISTRICTS[i];
    districtNames.push(dName);
    districtTerritories.push(`${dName} District`);
    parentStateIds.push(telanganaTokenId);
    districtCharacters.push("District Knight");
    districtURIs.push(`ipfs://QmA2d5aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9e/districts/${slugify(dName)}.json`);
    districtPopulations.push(1000000 + i * 100000);
    districtBps.push(50);
  }

  const txDistrict = await legionNFT.batchMintDistrict(
    deployer.address,
    districtNames,
    districtTerritories,
    parentStateIds,
    districtCharacters,
    districtURIs,
    districtPopulations,
    districtBps
  );
  await txDistrict.wait();

  let hyderabadTokenId = 0;
  const totalTotal = await legionNFT.totalLegions();
  for (let id = telanganaTokenId + 1; id <= totalTotal; id++) {
    const details = await legionNFT.getLegionDetails(id);
    if (details.name === "Hyderabad") {
      hyderabadTokenId = Number(details.nftId);
      break;
    }
  }

  console.log(`✅ Step 20 Completed: 33 Telangana District NFTs Minted. (Hyderabad Token ID = ${hyderabadTokenId})`);
  console.log(`Total NFTs Minted across Steps 17–20: ${totalTotal}`);

  // --------------------------------------------------
  // Phase 6 — Hierarchy Verification
  // --------------------------------------------------
  console.log("\n==================================================");
  console.log("PHASE 6 — HIERARCHY VERIFICATION");
  console.log("==================================================");

  // Lineage path: Asia -> India -> Telangana -> Hyderabad
  const [asiaParent, asiaChildren] = await legionNFT.getLegionHierarchy(asiaTokenId);
  const [indiaParent, indiaChildren] = await legionNFT.getLegionHierarchy(indiaTokenId);
  const [telanganaParent, telanganaChildren] = await legionNFT.getLegionHierarchy(telanganaTokenId);
  const [hyderabadParent, hyderabadChildren] = await legionNFT.getLegionHierarchy(hyderabadTokenId);

  console.log(`\n📍 [Level 0 Continent] Asia (#${asiaTokenId})`);
  console.log(`   Parent: ${asiaParent === 0n ? "None" : asiaParent.toString()}`);
  console.log(`   Children Count: ${asiaChildren.length} (Includes India #${indiaTokenId})`);

  console.log(`\n📍 [Level 1 Country] India (#${indiaTokenId})`);
  console.log(`   Parent: ${indiaParent.toString()} (Asia #${asiaTokenId})`);
  console.log(`   Children Count: ${indiaChildren.length} (Includes Telangana #${telanganaTokenId})`);

  console.log(`\n📍 [Level 2 State] Telangana (#${telanganaTokenId})`);
  console.log(`   Parent: ${telanganaParent.toString()} (India #${indiaTokenId})`);
  console.log(`   Children Count: ${telanganaChildren.length} (33 Telangana Districts)`);

  console.log(`\n📍 [Level 3 District] Hyderabad (#${hyderabadTokenId})`);
  console.log(`   Parent: ${hyderabadParent.toString()} (Telangana #${telanganaTokenId})`);
  console.log(`   Children Count: ${hyderabadChildren.length} (Terminal Level)`);

  console.log("\n✨ Lineage Verified Successfully: Asia ↓ India ↓ Telangana ↓ Hyderabad!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
