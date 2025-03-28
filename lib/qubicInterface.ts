import { RequestPackageTypes } from "./requestPackageTypes";
import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper";
import { QubicTransferAssetPayload } from "@qubic-lib/qubic-ts-library/dist/qubic-types/transacion-payloads/QubicTransferAssetPayload";
import { QubicTransaction } from "@qubic-lib/qubic-ts-library/dist/qubic-types/QubicTransaction";
import { RequestResponseHeader } from "@qubic-lib/qubic-ts-library/dist/qubic-communication/RequestResponseHeader";
import { PublicKey } from "@qubic-lib/qubic-ts-library/dist/qubic-types/PublicKey";
import { QubicDefinitions } from "@qubic-lib/qubic-ts-library/dist/QubicDefinitions";
import { QubicPackageBuilder } from "@qubic-lib/qubic-ts-library/dist/QubicPackageBuilder";
import { IQubicBuildPackage } from "@qubic-lib/qubic-ts-library/dist/qubic-types/IQubicBuildPackage";
import { QubicTransferSendManyPayload } from "@qubic-lib/qubic-ts-library/dist/qubic-types/transacion-payloads/QubicTransferSendManyPayload";

export function encodeBase64Bytes(bytes: Uint8Array): string {
  return btoa(
    bytes.reduce((acc, current) => acc + String.fromCharCode(current), "")
  );
}

export function base64ToUint8(base64: string) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export class QubicInterface {
  private qubicHelper: QubicHelper = new QubicHelper();

  async getPublicId(seed: string) {
    const result = await this.qubicHelper.createIdPackage(seed);
    return {
      publicId: result.publicId,
      publicKeyB64: arrayBufferToBase64(result.publicKey),
      privateKeyB64: arrayBufferToBase64(result.privateKey),
    };
  }

  async verifyIdentity(publicId: string): Promise<boolean> {
    return this.qubicHelper.verifyIdentity(publicId);
  }

  async sendTransactionRaw(base64: string) {
    const transaction = new QubicTransaction();
    const header = new RequestResponseHeader(
      RequestPackageTypes.BROADCAST_TRANSACTION,
      transaction.getPackageSize()
    );
    return {
      header: header.getPackageData(),
      transaction: base64ToArrayBuffer(base64),
    };
  }

  async parseTransferSendManyPayload(payload: Uint8Array) {
    const parsedSendManyPayload = new QubicTransferSendManyPayload();
    await parsedSendManyPayload.parse(payload);

    const transfers = parsedSendManyPayload.getTransfers();

    return transfers.map((item) => ({
      amount: item.amount.getNumber().toString(),
      destId: item.destId.getIdentityAsSring() ?? "",
    }));
  }
  //Signs a raw arraybuffer with a seed
  //Gets the signed data, digest and signature (base64 encoded)
  async getSignedFromRaw(rawBase64: string, seed: string) {
    const rawUint8 = base64ToUint8(rawBase64);
    const builder = new QubicPackageBuilder(
      rawUint8.byteLength + QubicDefinitions.SIGNATURE_LENGTH
    );
    builder.adduint8Array(rawUint8);
    const { signedData, digest, signature } = await builder.signAndDigest(seed);

    return {
      signedData: arrayBufferToBase64(signedData),
      digest: arrayBufferToBase64(digest),
      signature: arrayBufferToBase64(signature),
    };
  }

  //Signs an ASCII string with a seed
  //Gets the signed data, digest and signature (base64 encoded)
  async getSignedFromASCIIString(asciiString: string, seed: string) {
    const rawUint8 = Uint8Array.from(
      asciiString.split("").map((x) => x.charCodeAt(0))
    );
    const builder = new QubicPackageBuilder(
      rawUint8.byteLength + QubicDefinitions.SIGNATURE_LENGTH
    );
    builder.adduint8Array(rawUint8);
    const { signedData, digest, signature } = await builder.signAndDigest(seed);

    return {
      signedData: arrayBufferToBase64(signedData),
      digest: arrayBufferToBase64(digest),
      signature: arrayBufferToBase64(signature),
    };
  }

  //Signs an UTF-8 string with a seed
  //Gets the signed data, digest and signature (base64 encoded)
  async getSignedFromUTFString(utf8String: string, seed: string) {
    const textEncoder = new TextEncoder();
    const rawUint8 = textEncoder.encode(utf8String);
    const builder = new QubicPackageBuilder(
      rawUint8.byteLength + QubicDefinitions.SIGNATURE_LENGTH
    );
    builder.adduint8Array(rawUint8);
    const { signedData, digest, signature } = await builder.signAndDigest(seed);

    return {
      signedData: arrayBufferToBase64(signedData),
      digest: arrayBufferToBase64(digest),
      signature: arrayBufferToBase64(signature),
    };
  }

  async getTransaction(
    sourceSeed: string,
    destinationPublicId: string,
    amount: number,
    tick: number,
    asBase64: boolean = true
  ) {
    const sourceInfo = await this.qubicHelper.createIdPackage(sourceSeed);
    const transaction = new QubicTransaction()
      .setDestinationPublicKey(destinationPublicId)
      .setSourcePublicKey(sourceInfo.publicId)
      .setAmount(amount)
      .setTick(tick);

    const tx = await transaction.build(sourceSeed);

    return {
      transaction: asBase64
        ? arrayBufferToBase64(transaction.getPackageData())
        : transaction.getPackageData(),
      transactionId: transaction.getId(),
    };
  }

  async getTransactionWithPayload(
    sourceSeed: string,
    destinationPublicId: string,
    amount: number,
    tick: number,
    inputType: number,
    payload: Uint8Array,
    asBase64: boolean = true
  ) {
    const sourceInfo = await this.qubicHelper.createIdPackage(sourceSeed);

    const transaction = new QubicTransaction()
      .setDestinationPublicKey(destinationPublicId)
      .setSourcePublicKey(sourceInfo.publicId)
      .setAmount(amount)
      .setInputType(inputType)
      .setTick(tick)
      .setPayload({
        getPackageData: () => payload,
        getPackageSize: () => payload.length,
      } as IQubicBuildPackage);

    const tx = await transaction.build(sourceSeed);

    return {
      transaction: asBase64
        ? arrayBufferToBase64(transaction.getPackageData())
        : transaction.getPackageData(),
      transactionId: transaction.getId(),
    };
  }

  parseAssetTransferPayload = async (payload: Uint8Array) => {
    const assetTransfer = new QubicTransferAssetPayload();
    await assetTransfer.parse(payload);
    return {
      assetName: Object.values(assetTransfer.getAssetName())
        .map((code) => String.fromCharCode(code))
        .join("")
        .replace(/\0/g, ""),
      assetIssuer: assetTransfer.getNewOwnerAndPossessor().getIdentityAsSring(),
      numberOfUnits: assetTransfer.getNumberOfUnits(),
    };
  };

  getAssetTransferTransaction = async (
    sourceSeed: string,
    destinationPublicId: string,
    assetName: string,
    assetIssuer: string,
    numberOfUnits: number,
    tick: number,
    asBase64: boolean = true
  ) => {
    const sourceInfo = await this.qubicHelper.createIdPackage(sourceSeed);
    const targetAddress = new PublicKey(destinationPublicId);

    const assetTransfer = new QubicTransferAssetPayload()
      .setIssuer(assetIssuer)
      .setNewOwnerAndPossessor(destinationPublicId)
      .setAssetName(assetName)
      .setNumberOfUnits(numberOfUnits);

    // build and sign tx
    const transaction = new QubicTransaction()
      .setSourcePublicKey(sourceInfo.publicId)
      .setDestinationPublicKey(QubicDefinitions.QX_ADDRESS) // a transfer should go the QX SC
      .setAmount(QubicDefinitions.QX_TRANSFER_ASSET_FEE)
      .setTick(tick) // just a fake tick
      .setInputType(QubicDefinitions.QX_TRANSFER_ASSET_INPUT_TYPE)
      .setPayload(assetTransfer);

    const tx = await transaction.build(sourceSeed);

    return {
      transaction: asBase64
        ? arrayBufferToBase64(transaction.getPackageData())
        : transaction.getPackageData(),
    };
  };
}
