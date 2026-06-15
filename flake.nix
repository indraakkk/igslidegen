{
  description = "IG Slides — client-side Instagram carousel generator";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          # Node runtime comes from nix; the Vercel CLI is pinned as a project
          # devDependency (locked in package-lock.json) — it was removed from
          # nixpkgs, so this keeps it reproducible without brew or a global install.
          packages = [
            pkgs.nodejs_22
          ];

          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
            if [ ! -x node_modules/.bin/vercel ]; then
              echo "Installing JS deps (incl. vercel CLI)…"
              npm install
            fi
            echo "IG Slides dev shell — node $(node --version), vercel $(vercel --version 2>/dev/null)"
          '';
        };
      });
}
