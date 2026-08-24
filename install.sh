#!/bin/sh
set -eu
set -f

release_repository="DengNaichen/harnesskit-releases"
release_repository_url="https://github.com/${release_repository}"
requested_version=""
download_directory=""
install_temporary=""

fail() {
	printf 'harnesskit installer: %s\n' "$1" >&2
	exit 1
}

usage() {
	printf '%s\n' 'Usage: install.sh [--version X.Y.Z]'
}

cleanup() {
	if [ -n "${install_temporary}" ] && [ -e "${install_temporary}" ]; then
		rm -f -- "${install_temporary}"
	fi
	if [ -n "${download_directory}" ] && [ -d "${download_directory}" ]; then
		rm -rf -- "${download_directory}"
	fi
}
trap cleanup 0 1 2 15

while [ "$#" -gt 0 ]; do
	case "$1" in
		--version)
			[ "$#" -ge 2 ] || {
				usage >&2
				exit 2
			}
			requested_version=$2
			shift 2
			;;
		--help|-h)
			usage
			exit 0
			;;
		*)
			usage >&2
			exit 2
			;;
	esac
done

for required_command in awk curl grep mktemp mkdir install mv rm chmod uname wc; do
	command -v "${required_command}" >/dev/null 2>&1 || fail "required command not found: ${required_command}"
done

operating_system=$(uname -s)
architecture=$(uname -m)
case "${operating_system}/${architecture}" in
	Darwin/arm64)
		target="aarch64-apple-darwin"
		archive_extension="zip"
		checksum_tool="shasum"
		extractor="unzip"
		;;
	Linux/x86_64|Linux/amd64)
		target="x86_64-unknown-linux-musl"
		archive_extension="tar.gz"
		checksum_tool="sha256sum"
		extractor="tar"
		;;
	*)
		fail "unsupported platform: ${operating_system}/${architecture}"
		;;
esac
command -v "${checksum_tool}" >/dev/null 2>&1 || fail "required command not found: ${checksum_tool}"
command -v "${extractor}" >/dev/null 2>&1 || fail "required command not found: ${extractor}"

if [ -z "${requested_version}" ]; then
	latest_url=$(curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --location --silent --show-error --output /dev/null --write-out '%{url_effective}' "${release_repository_url}/releases/latest")
	latest_url=${latest_url%/}
	case "${latest_url}" in
		"${release_repository_url}"/releases/tag/harnesskit-v*)
			latest_tag=${latest_url##*/}
			requested_version=${latest_tag#harnesskit-v}
			;;
		*) fail "latest release did not resolve to a HarnessKit version" ;;
	esac
fi

printf '%s\n' "${requested_version}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "version must be X.Y.Z"
release_tag="harnesskit-v${requested_version}"
archive="${release_tag}-${target}.${archive_extension}"
download_base="${release_repository_url}/releases/download/${release_tag}"

download_directory=$(mktemp -d "${TMPDIR:-/tmp}/harnesskit-install.XXXXXX")
archive_path="${download_directory}/${archive}"
checksum_path="${archive_path}.sha256"
binary_path="${download_directory}/harnesskit"

curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --location --silent --show-error --output "${archive_path}" "${download_base}/${archive}"
curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --location --silent --show-error --output "${checksum_path}" "${download_base}/${archive}.sha256"

IFS= read -r checksum_line < "${checksum_path}" || fail "checksum file is unreadable"
[ "$(wc -l < "${checksum_path}")" -eq 1 ] || fail "checksum file has an invalid shape"
set -- ${checksum_line}
[ "$#" -eq 2 ] || fail "checksum file has an invalid shape"
expected_checksum=$1
checksum_name=$2
[ "${#expected_checksum}" -eq 64 ] || fail "checksum is not SHA-256"
case "${expected_checksum}" in
	*[!0-9a-f]*) fail "checksum is not lowercase SHA-256" ;;
esac
[ "${checksum_name}" = "${archive}" ] || fail "checksum filename does not match the archive"

case "${checksum_tool}" in
	shasum) actual_checksum=$(shasum -a 256 "${archive_path}" | awk '{print $1}') ;;
	sha256sum) actual_checksum=$(sha256sum "${archive_path}" | awk '{print $1}') ;;
esac
[ "${actual_checksum}" = "${expected_checksum}" ] || fail "archive checksum mismatch"

case "${extractor}" in
	unzip) unzip -p "${archive_path}" harnesskit > "${binary_path}" ;;
	tar) tar -xOzf "${archive_path}" harnesskit > "${binary_path}" ;;
esac
[ -s "${binary_path}" ] || fail "archive does not contain harnesskit"
chmod 755 "${binary_path}"
expected_version="harnesskit ${requested_version} (contract 6)"
actual_version=$("${binary_path}" --version) || fail "downloaded harnesskit could not run"
[ "${actual_version}" = "${expected_version}" ] || fail "downloaded harnesskit version does not match ${requested_version}"

: "${HOME:?HOME is required}"
install_directory="${HOME}/.local/bin"
mkdir -p "${install_directory}"
install_temporary=$(mktemp "${install_directory}/.harnesskit.XXXXXX")
install -m 755 "${binary_path}" "${install_temporary}"
mv -f -- "${install_temporary}" "${install_directory}/harnesskit"
install_temporary=""

printf 'Installed %s to %s\n' "${actual_version}" "${install_directory}/harnesskit"
case ":${PATH:-}:" in
	*":${install_directory}:"*) ;;
	*) printf 'Add %s to PATH to run harnesskit directly.\n' "${install_directory}" ;;
esac
