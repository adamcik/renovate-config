{
  description = "Shared Renovate configuration presets";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    flake-parts.inputs.nixpkgs-lib.follows = "nixpkgs";
    nix-tooling.url = "github:adamcik/nix-tooling";
    nix-tooling.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" ];
      imports = [
        inputs.nix-tooling.flakeModules.formatting.common
        inputs.nix-tooling.flakeModules.formatting.web
      ];

      perSystem = { pkgs, ... }: {
        checks.renovate-config =
          pkgs.runCommand "renovate-config"
            {
              nativeBuildInputs = [
                pkgs.nodejs
                pkgs.renovate
              ];
            }
            ''
              cp -r ${./.} source
              chmod -R u+w source
              cd source
              renovate-config-validator --strict --no-global \
                default.json application.json library.json automerge.json renovate.json
              RENOVATE_PACKAGE_DIR=${pkgs.renovate}/lib/node_modules/renovate \
                node tests/grouping.mjs
              touch "$out"
            '';

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.renovate
          ];
        };
      };
    };
}
