const { storeNftAsset } = require('../../services/nftAssetStorage.cjs');

function attributes(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value || '[]');
    if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== 'object' || typeof item.trait_type !== 'string' || !('value' in item))) throw new Error();
    return parsed;
  } catch { throw new Error('Attributes must be a JSON array of ERC-721 trait_type/value objects.'); }
}

exports.createMetadata = async (req, res, next) => {
  try {
    const { name, description, externalUrl, attributes: rawAttributes } = req.body;
    if (!name?.trim() || !description?.trim() || !externalUrl?.trim()) return res.status(400).json({ success: false, message: 'Name, description, and external URL are required.' });
    const result = await storeNftAsset(req.file, { name: name.trim(), description: description.trim(), external_url: externalUrl.trim(), attributes: attributes(rawAttributes) });
    return res.status(201).json({ success: true, data: result });
  } catch (error) { return next(error); }
};
