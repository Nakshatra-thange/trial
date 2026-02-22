
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

/**
 * Upload image file to IPFS via Pinata
 * Returns IPFS hash (CID)
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:3000/api/ipfs/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  return data.IpfsHash;
}

/**
 * Upload metadata JSON to IPFS via Pinata
 * Returns full IPFS URI
 */
export async function uploadMetadataToIPFS(metadata: TokenMetadata): Promise<string> {
  const response = await fetch("http://localhost:3000/api/ipfs/upload-json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error(`Metadata upload failed: ${response.statusText}`);
  }

  const raw = await response.text();
console.log("UPLOAD JSON RAW:", raw);
const data = JSON.parse(raw);

  //const data = await response.json();
  return `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`;
  
}

/**
 * Complete flow: upload image + metadata
 * Returns metadata URI for on-chain storage
 */
export async function uploadTokenMetadata(
  name: string,
  symbol: string,
  description: string,
  imageFile: File
): Promise<string> {
  // 1. Upload image
  const imageHash = await uploadImageToIPFS(imageFile);
  const imageUrl = `${PINATA_GATEWAY}/ipfs/${imageHash}`;
  
  // 2. Build metadata
  const metadata: TokenMetadata = {
    name,
    symbol,
    description,
    image: imageUrl,
  };

  // 3. Upload metadata
  const metadataUri = await uploadMetadataToIPFS(metadata);

  return metadataUri;
}