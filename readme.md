# Qubic Helper Utilities

Conversion of the Qubic Ts-Library https://github.com/qubic/ts-library to an executable so as to be used in Windows, Linux and Mac desktops and to a packaged html (so it can be used in a web RPC proxy).
Most probably a rust version of the Kangaroo12 and other implementations would be better but this will suffice for now.

## Compilation

`npm run build-all` will build the index.html , and windows , mac and linux files

## Usage

The application responds with JSON in stdout:

### Get the public ID from a seed

`qubic-helper createPublicId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`

Will result in :
`{"publicId":"BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK","publicKeyB64":"H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQ=","privateKeyB64":"H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQ=","status":"ok"}``

in browser:
await runBrowser("createPublicId","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

will result in
`{
    "publicId": "BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK",
    "publicKeyB64": "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQ=",
    "privateKeyB64": "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQ=",
    "status": "ok"
}`

### Get base64 of a transaction

`qubic-helper createTransaction aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA 10000 10000000`
createTransaction sourceSeed destinationId numberOfAssets tick

Will result in :
`{"transaction":"H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAnAAAAAAAAgJaYAAAAAAALYtCM56ZJoIzY0Iq4MFgeNH/HTNG/fNwEULHczxoEK4dF9CJmYobaRPP1GdGVSBR/a9EEyyVZiasSDfBk/QQA","status":"ok"}`

in browser:

awaitrunBrowser("createTransaction","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",10000,10000000);

will result in

`{
    "transaction": "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAnAAAAAAAAgJaYAAAAAAALYtCM56ZJoIzY0Iq4MFgeNH/HTNG/fNwEULHczxoEK4dF9CJmYobaRPP1GdGVSBR/a9EEyyVZiasSDfBk/QQA",
    "status": "ok"
}`

### Get the base64 of a transaction for asset transfer

createTransactionAssetMove sourceSeed destinationId AssetName AssetIssuer NumberOfAssets Tick
`qubic-helper createTransactionAssetMove aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA ASSETNAME AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB 1 10000000`
Will result in :
`{"transaction":"H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBCDwAAAAAAgJaYAAIAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQVNTRVROQU0BAAAAAAAAALeE6hXICPI46k8ivouJv23KLKJ+O/B90RUZb71mAYaPYigkuWpWF3PgLPiIDJGWc21ZXnTuYhlGvvS9V7gIDQA=","status":"ok"}`
``

in browser
await runBrowser("createTransactionAssetMove","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","ASSETNAME","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB",1,10000000);

will result in:
`{
    "transaction": "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUQBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBCDwAAAAAAgJaYAAIAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQVNTRVROQU0BAAAAAAAAALeE6hXICPI46k8ivouJv23KLKJ+O/B90RUZb71mAYaPYigkuWpWF3PgLPiIDJGWc21ZXnTuYhlGvvS9V7gIDQA=",
    "status": "ok"
}`

### Get a vault file with seeds

`qubic-helper wallet.createVaultFile 1234578a "[{\"alias\":\"Number 1\",\"seed\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"publicId\":\"BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK\"}]"`
Will result in:
`{"base64":"...","status":"ok"}

in browser
await runBrowser("wallet.createVaultFile","1234578a","[{\"alias\":\"Number 1\",\"seed\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"publicId\":\"BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK\"}]");

will result in:
`{
"base64": "...."
"status": "ok"
}

### Read the contents of a vault file

`qubic-helper wallet.importVaultFile 1234578a "C:\my files\file.qubic-vault"
Will result in: 
`{"seeds":[{"alias":"....","seed":"...."}],"status":"ok"}`

Will not run in browser

### Read the contents of a base64 encoded vault file

Will only run in browser
runBrowser("wallet.importVault","123456a!","eyJ.............................==");

Will result in
`{
"seeds": [ {"alias":"alias1","publicId":"BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK", "seed":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]
}

### Sign an base64 encoded Uint8Array with a seed

runBrowser("createSigned.fromRaw,"wqbdupxgcaimwdsnchitjmsplzclkqokhadgehdxqogeeiovzvadstt" , "LFBFINqxRgQETkwFSxtTK0pVZzLSmAs=")

Will result in
`{
"signedData":"LFBFINqxRgQETkwFSxtTK0pVZzLSmAt1zcuzWHmPs0DsJi+D3Eh0bxlU0L1wYn/UhuVILvA+5HHl3nNmYzKAbICytq4UdmtfCQ8GFX95Fo6lI9gI+g8A","digest":"dQhtnnSgtj7DnK6aQ+E5uQRk/m8jvv4wrwNTe2byf3s=",
"signature":"dc3Ls1h5j7NA7CYvg9xIdG8ZVNC9cGJ/1IblSC7wPuRx5d5zZmMygGyAsrauFHZrXwkPBhV/eRaOpSPYCPoPAA==",
"status":"ok"
}

### Sign an ASCII encoded String with a seed

runBrowser("createSigned.fromASCII,"wqbdupxgcaimwdsnchitjmsplzclkqokhadgehdxqogeeiovzvadstt" , "thisIsAnAscIIText")

Will result in
`{
"signedData":"dGhpc0lzQW5Bc2NJSVRleHQ2ZEAJeoIMWydjfntAFSIHLxW8I7fgquFczd/TIUdrgcXBrxssVY2FWpuNM8h8nP4YNU8UvP2vA7PgbOzyDhMA","digest":"0Gm1OdQ2luukSPJqj2fnvuvGBvW7kOL5ZDDLA1ezfGo=",
"signature":"NmRACXqCDFsnY357QBUiBy8VvCO34KrhXM3f0yFHa4HFwa8bLFWNhVqbjTPIfJz+GDVPFLz9rwOz4Gzs8g4TAA==",
"status":"ok"
}`

### Sign a UTF-8 encoded string with a seed

runBrowser("createSigned.fromUTF,"wqbdupxgcaimwdsnchitjmsplzclkqokhadgehdxqogeeiovzvadstt" , "😊😊😊😊")

Will result in
`{
"signedData":"8J+YivCfmIrwn5iK8J+YinUNmhF0SMHePsWfPcnAy2FpTnLavU+lc9x0l13Eh02+dr+JuRppgCDdOZyXFe57ETE5acND8wzufeXpN0vgFgA=","digest":"2s/NjymcINVrG+ZoQ69PSTAd5MKzv5UGVBfsrRZR6kE=",
"signature":"dQ2aEXRIwd4+xZ89ycDLYWlOctq9T6Vz3HSXXcSHTb52v4m5GmmAIN05nJcV7nsRMTlpw0PzDO595ek3S+AWAA==",
"status":"ok"
}`

### Parse the payload of a transfer of QX Transfer Shares

runBrowser("parseAssetTransferPayload", "7c151fb37ec505fd34cbf5ea0dcea413f24d9e3a4dd030e5d9047faf4061b0aadedab224eddadcfcd90c6737de1fbb1fa0380679ccdd1a322afacf3e433ea0ac51434150000000002316000000000000")

Will result in
`
{assetName: QCAP, assetIssuer: ITIRKKVFOSHYIHJORKDWUWZUYYXAIEEAYJANFRRVLBMPQZVTVTGNBJAFIUCA, numberOfUnits: {value: 5667}, status: ok}
`

### Parse the payload of a QUtil Send to Many

runBrowser("parseTransferSendManyPayload", "7c151fb37ec505fd34cbf5ea0dcea413f24d9e3a4dd030e5d9047faf4061b0aadedab224eddadcfcd90c6737de1fbb1fa0380679ccdd1a322afacf3e433ea0ac51434150000000002316000000000000")

Will result in
`
{"0":{"amount":"24228094","destId":"UOOJAJPGQFVYXEUHAEEORABYMULAYFWQLWLKDCOVBHOFQGHBFKJFMQUDUMKK"},"1":{"amount":"4038015","destId":"JRJQDAPCMAKHUFCPHSTTBNIIESKCQEXGKAWOYAHSDASPDSAUKEIBQAYERBIK"},"2":{"amount":"113064442","destId":"YCGYICIFPZUJHDCPGFEAADKDXVACYQSTPGUMXFCUFDFIEEKBXKPVDYFAXEWK"},"3":{"amount":"4038015","destId":"EETPTHSSWLAWBBXWRRNBTZFASPUCMGCNOYWKBTNFBAYGBKBDAVUQHXRFYIZJ"},"4":{"amount":"4038015","destId":"XOJGYAJBAFFODAWDHXFYHZIDWNCAFWMPIBHMWKFDUCRTGQRLYVZYZHFHOTAH"},"5":{"amount":"1122568392","destId":"RJMSOJQHTXADODNHARGBFUGQARDCFHNTMFLTSRZCYGXTIMQOAHLEAMKDGRFA"},"6":{"amount":"214014837","destId":"QOUHWYSJFNWMYAKLYPMPIJBLRUVBCPSFXCXFMHHMNDNJJTTCZXKVULIDNBXK"},"7":{"amount":"24228094","destId":"LXYMESTELGNMKAUIOHQVFFLDENWACVNNNEUNMGRSHAKPXFPWCTCODOLBWJXJ"},"8":{"amount":"20190079","destId":"AGQAENGDCNBTYDNOQDAOAMRGXMACALBWVKHRKHEZBEBFYYONQTGCRQPFQTIE"},"9":{"amount":"64608252","destId":"KTMQPESVHSMMUENEXODDVFJIHKKCIMBCICGPGTGBGHLHJKYRHABWSUCCYTVN"},"status":"ok"}
`


### Error handling

Errors will result in
`{"status":"error","error":"Error description"}`

## Development info

- Everything is written in Typescript (and some javascript). Typescript is transpiled to Javascript and then bundled to a single file with esbuild. The esbuild generated file is the fed to pkg and the executables are created.
- index.html contains the packaged dependencies in one single file. The window object is enhanced with a new instance of QubicInterface
