# Generate keys

openssl req -out CSR.csr -new -newkey rsa:2048 -nodes -keyout privateKey.key

openssl rsa -in privateKey.key -pubout > key.pub

cp key.pub publicKey.key

# edit publicKey.key, delete first and last lines
