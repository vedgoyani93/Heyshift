FROM busybox:stable
COPY . /www
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
