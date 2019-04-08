/*
 * firefox-addons-add-update-version
 *
 * @summary workflow and base code for developing WebExtensions browser add-ons
 * @author Michel Gutierrez
 * @link https://github.com/mi-g/weh
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const fs = require('fs');
const argv = require('yargs').argv;
const unzip = require('unzip2');
const crypto = require('crypto');
const compver = require('mozilla-version-comparator');

function Usage() {
	console.info(`Usage: faauv [options] <xpi file path>
Options:
  --update-in <update.json file path>: path to original update.json file
  --update-out <update.json file path>: path to update.json file to be created
  --update <update.json file path>: shortcut to specify both --update-in and --update-out
  --update-link <url where to download xpi>: update link to download new add-on version

Notes:
  When using the --update-link option, you can use the placeholder @version@ to be \
replaced by the new add-on version string.

  If former versions already exist in the original update.json, all the extra \
parameters (e.g {"applications":{"gecko":{"strict-minimum-version":"..."}}}) \
from the latest version are re-used in the new entry.

  This is also the case for the update_link property, if not specified as command \
line parameter, with the version string being replaced in the url. For \
instance if a previous version "1.0.1" had update_link "https://mysite.com/download?v=1.0.1" \
and you add version "1.0.2" without specifying the update-link option, \
the new entry will automatically set update_link to "https://mysite.com/download?v=1.0.2".
`)
}

if (argv._.length == 0) {
	Usage();
	process.exit(-1);
}

var filePath = argv._[0];
try {
	fs.statSync(filePath);
} catch (e) {
	console.error("File", filePath, "does not exist");
	process.exit(-1);
}

var gotManifest = false;
var gotMozillaSign = false;
var updateInputPath = argv["update-in"] || argv["update"] || null;
var updateOutputPath = argv["update-out"] || argv["update"] || null;

var update = {
	addons: {}
};

if(updateInputPath) {
	try {
		fs.statSync(updateInputPath);
		update = JSON.parse(fs.readFileSync(updateInputPath,"utf8"));
	} catch(e) {
		console.warn("Could not read update file",updateInputPath,":",e.message,
		". Assuming new update manifest");
	}
}

fs.createReadStream(filePath)
	.pipe(unzip.Parse())
	.on('entry', function (entry) {
		var fileName = entry.path;
		if (fileName === "manifest.json") {
			gotManifest = true;
			let buffers = [];
			entry.on("data",(data)=>{
				buffers.push(data);
			});
			entry.on("end",()=>{
				HandleManifest(Buffer.concat(buffers).toString("utf8"));
			})
		} else if(fileName === "META-INF/mozilla.sf") {
			gotMozillaSign = true;
		} else {
			entry.autodrain();
		}
	})
	.on("close",()=>{
		if(!gotManifest)
			console.error("No manifest.json found in",filePath);
		if(!gotMozillaSign)
			console.warn("File",filePath,"has not been signed by Mozilla");
	});

function HandleManifest(manifestStr) {
	var manifest;
	try {
		manifest = JSON.parse(manifestStr);
		if(updateOutputPath) {
			var addonId = manifest && manifest.applications && 
				manifest.applications.gecko &&
				manifest.applications.gecko.id;
			if(!addonId) {
				console.error("Add-on id not found in manifest");
				process.exit(-1);
			} 
			if(!update.addons[addonId])
				update.addons[addonId] = {};
			var lastVersion = null;
			update.addons[addonId].updates = (update.addons[addonId].updates || []).filter((entry)=>{
				if(lastVersion===null || compver(entry.version,lastVersion.version)>0)
					lastVersion = entry;
				if(entry.version===manifest.version) {
					console.warn("Found already existing version",manifest.version,"in update file");
					return false;
				} else
					return true;
			});
			var updateUrl = argv["update-link"];
			if(!updateUrl) {
				if(lastVersion && lastVersion.update_link) {
					updateUrl = lastVersion.update_link.replace(
						encodeURIComponent(lastVersion.version),
						encodeURIComponent(manifest.version));
					console.info("Reusing former update URL",lastVersion.update_link,"=>",updateUrl);
				} else {
					console.error("No update URL specified nor reused. Try using parameter --update-link");
					process.exit(-1);
				}
			} else
				updateUrl = updateUrl.replace("@version@",encodeURIComponent(manifest.version));
			Sha256FromFile(filePath)
				.then((hash)=>{
					var entry = Object.assign({},lastVersion,{
						version: manifest.version,
						update_hash: "sha256:"+hash,
						update_link: updateUrl
					});
					update.addons[addonId].updates.push(entry);
					if(updateOutputPath) 
						try {
							fs.writeFileSync(updateOutputPath,
								JSON.stringify(update,null,4),"utf8");
							console.info("Update file written",updateOutputPath);
						} catch(e) {
							console.error("Could not write update file",
								updateOutputPath,":",e.message);
							process.exit(-1);
						}
				})
				.catch((err)=>{
					console.error("Could not compute hash:",err.message);
					process.exit(-1);
				});
		} else 
			console.info("No update.json output path specified. You may want to use option --update-out or --update");
	} catch(e) {
		console.error("Could not parse manifest",e.message);
		process.exit(-1);
	}
}

function Sha256FromFile(path) {
	return new Promise((resolve, reject) => {
		var shasum = crypto.createHash("sha256");
		var stream = fs.ReadStream(path);
		stream.on("data",(data)=>{
			shasum.update(data);
		});
		stream.on("end",()=>{
			resolve(shasum.digest("hex"));
		});
		stream.on("error",(err)=>{
			reject(err);
		});
	});
}
