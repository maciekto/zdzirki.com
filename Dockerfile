FROM nginx:alpine

# Kopiujemy tylko statyczne pliki strony (bez .git, compose itp.)
COPY index.html zdzirki.mp3 washabledrake.jpg ajayoxleywannabe.jpg makeover.jpg /usr/share/nginx/html/

EXPOSE 80
