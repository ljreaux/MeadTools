# Local pilot only: permit the read-only file:// repository mounted by Compose.
# Remove this override when moving Weblate to its permanent host, where the
# repository should be accessed through GitHub using SSH or HTTPS.
VCS_ALLOW_SCHEMES = {"https", "ssh", "file"}
