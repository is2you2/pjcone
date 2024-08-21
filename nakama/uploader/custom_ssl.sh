openssl genpkey -algorithm RSA -out private.key
openssl req -new -key private.key -out request.csr
openssl req -x509 -nodes -days 365 -key private.key -in request.csr -out public.crt