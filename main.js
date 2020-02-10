// Tenant info
let deploy;
let tenant;
let saasHost;


// Modifies problem details page
let enhanceProblemDetails = function () {  
    
    let url;
    let apiKey;
    let re_tag_filter_key;
    
    //Wait for the "out of the box" problem details to load before proceeding and trying to insert the additional ones
    if (document.querySelector('[uitestid="gwt-debug-leftColumn"]')) {
       
            getTenantInfo();            

            chrome.storage.local.get([tenant], function(result) {
            // No settings stored, nothing to do
            if (result[tenant]==null || result[tenant]==undefined) return;

            //Secondary regex to make sure we are still on the problem details page
            let check = new RegExp('/#problems/problemdetails').exec(window.location.href);
            
            if(check != null) {
                console.log("Enhancing problem entities");

                //Use a regex to get the Problem ID from the URL so we can query the exact start/end times
                let resultsProblem = new RegExp('(pid=)([^_]*)').exec(window.location.href);
                let problemId = resultsProblem[2];

                //Retrieve the settings from the extension
                if(result[tenant].api_key != null && result[tenant].api_key != undefined) { apiKey = result[tenant].api_key; } else { apiKey = "dummy"; }
                if(result[tenant].tag_filter_key != null && result[tenant].tag_filter_key != undefined) { tag_filter_key = new RegExp(result[tenant].tag_filter_key,"g"); } else { tag_filter_key = new RegExp(".*","g"); }
                                
                //Create headers ready to perform a GET request on the API
                let myHeaders = new Headers();
                myHeaders.append("Authorization", "Api-Token " + apiKey);
            
                //Set the options for the request including that it is a GET request and adding the headers in
                let myInit = { method: 'GET',
                    headers: myHeaders,
                    cache: 'default',
                }

                //If you're on a SaaS tenant, construct the URL from the tenant ID and append it to the saas host (in case using a non-live Dynatrace tenant)
                if(deploy == "saas") {
                    url = tenant + '.' + saasHost;
                }

                //If you're on a Managed environment, extract the main part of the URL (because it can be anything) and add the environment ID extracted previously
                else if(deploy == "managed") {
                    let managedHost = new RegExp('(https://)([^\/]*)').exec(window.location.href);
                    url = managedHost[2] + '/e/' + tenant;
                }

                //Perform a simple request to the Smartscape API to check that the API key is authorized
                fetch('https://' + url + '/api/v1/entity/applications/', myInit)

                .then(function(response) {
                    //If the response isn't unauthorized, then continue with calculating the results using the values from above
                    if(response.status != 401) {
                        // Problem Members:
                        // a[uitestid='gwt-debug-problemMember'][href^='#']
                        entityBoxes = document.querySelectorAll("a[uitestid='gwt-debug-problemMember'][href^='#']");
                        entityBoxes.forEach(entityBox => {
                            enrichEntity(apiKey, tenant, entityBox, url);
                        });

                        // Root cause containers:
                        // div[uitestid='gwt-debug-rootCauseContainer'] > div >div > div > a[href^='#']
                        entityBoxes = document.querySelectorAll("div[uitestid='gwt-debug-rootCauseContainer'] > div >div > div > a[href^='#']");
                        entityBoxes.forEach(entityBox => {
                            enrichEntity(apiKey, tenant, entityBox, url);
                        });                                        
                    }    
                })  
            }
        }); 

        function enrichEntity(apiKey, tenant, entityBox, url) {
            let entityId = entityBox.getAttribute("href").match("id=([^;]*)")[1];

            //Create headers ready to perform a GET request on the API, setting the authorization header using the API key from local storage
            let myHeaders = new Headers();
            myHeaders.append("Authorization", "Api-Token " + apiKey);

            //Set the options for the request including that it is a GET request and adding the headers in
            let myInit = { method: 'GET',
                 headers: myHeaders,
                cache: 'default',
            };

            if (entityId.startsWith("SERVICE-")) {
                apiEndpoint = '/api/v1/entity/services/';
            } else if (entityId.startsWith('PROCESS_GROUP_INSTANCE-')) {
                apiEndpoint = '/api/v1/entity/infrastructure/processes/';
            } else if (entityId.startsWith('HOST-')) {
                apiEndpoint = '/api/v1/entity/infrastructure/hosts/';
            } else if (entityId.startsWith('APPLICATION-')) {
                apiEndpoint = '/api/v1/entity/application/';                
            } else if (entityId.startsWith('PROCESS_GROUP-')) {
                apiEndpoint = '/api/v1/entity/process-groups/';                
            } else {
                console.log("Unknown entity type for "+entityId)
                return;
            }
            //Call into the Problems API to get the start and end time, using the Problem ID extracted above
            fetch('https://' + url + apiEndpoint + entityId, myInit)
            .then(function(response) {
                //Extract the JSON response received
                return response.json();
            })
            .then(function(jsonResponse) {
                let tagContainer = document.createElement("div");
                tagContainer.style.float = "right";
                if (entityBox.children[0].tagName==="SPAN") {
                    entityBox.children[1].children[2].appendChild(tagContainer);                               
                } else {
                    entityBox.children[0].children[0].appendChild(tagContainer);                               
                }

                jsonResponse.tags.forEach(addTag);            
                function addTag(tag) {
                    let tagE = document.createElement("span");
                    tagE.style.backgroundColor = "#f2f2f2";
                    tagE.style.borderRadius = "15px";
                    tagE.style.padding = "2px 10px";

                    if (tag.value==null) {
                        tagE.innerHTML=tag.key;
                    } else {
                        tagE.innerHTML=tag.key + ":"+tag.value;
                    }
                    if (tag.key.match(tag_filter_key)) {
                        tagContainer.appendChild(tagE);
                    } else {
                        console.log("Not adding tag", tag.key, tag.value)
                    };
                };
            });
        };
    
		return;
    }
    //Not yet fully loaded problem page, keep checking
	window.requestAnimationFrame(enhanceProblemDetails);
};


// Changes color in the top UI bar for the tenant
let colorizeTenant = function() {

    if (document.querySelector('div[data-cache="topbar"]')) {
        getTenantInfo();
        chrome.storage.local.get([tenant], function(result) {
            // No settings stored, nothing to do
            if (result[tenant]==null || result[tenant]==undefined) return;

            let tenant_color = undefined;
            
            if(result[tenant].tenant_color != null && result[tenant].tenant_color != undefined) { 
                tenant_color = result[tenant].tenant_color;
            }

            if (tenant_color != undefined) {
                console.log("Colorizing current tenant with color ", tenant_color);
                selectors = ['div[data-cache="topbar"]', 'div[uitestid="gwt-debug-chatButton"]', 'div[id="mobileapp-user-menu"]', 'a[uitestid="gwt-debug-dashboardsButton-wrapper"]', 'span[uitestid="gwt-debug-hamburger"', 'span[uitestid="gwt-debug-prev"]', 'span[uitestid="gwt-debug-dateLabel"]', 'span[uitestid="gwt-debug-next"]']
                selectors.forEach(function (s) {
                    element = document.querySelector(s);
                    if (element!=null) {
                        element.style.backgroundColor=tenant_color;
                    }
                });        
            }
        });
    } else { 
        // Not yet ready to colorize, page not fully loaded, try again
        window.requestAnimationFrame(colorizeTenant);
    }
}

function getTenantInfo() {
    //Regexes to check what flavour of Dynatrace we are on, SaaS checks for a tenant ID (3 letters and 5 numbers) and Managed checks for an environment ID after "/e/"
    let saasCheck = new RegExp('(\/\/[a-z]{3}[1234567890]{5}\.)').exec(window.location.href);
    let managedCheck = new RegExp('(\/e\/[^\/]*)').exec(window.location.href);

    //If the SaaS check is true, extract the tenant ID from the URL and define the deployment as SaaS
    if(saasCheck != null) {
        let saasTenant = new RegExp('([a-z]{3}[1234567890]{5})').exec(window.location.href);
        tenant = saasTenant[0];

        function url_domain(data) {
            var    a      = document.createElement('a');
                   a.href = data;
            return a.hostname;
          }
          
        let saasRegex = new RegExp('([a-z]{3}[1234567890]{5}\.)(.*)').exec(url_domain(window.location.href));
        saasHost = saasRegex[2];
        deploy = "saas";
    }

    //If the Managed check is true, extract the environment ID from the URL and define the deployment as Managed
    else if(managedCheck != null) {
        let managedTenant = new RegExp('(\/e\/)([^\/]*)').exec(window.location.href);
        tenant = managedTenant[2];
        deploy = "managed";
    }
}


function retrieveWindowVariables(variables) {
    var ret = {};

    var scriptContent = "";
    for (var i = 0; i < variables.length; i++) {
        var currVariable = variables[i];
        scriptContent += "if (typeof " + currVariable + " !== 'undefined') $('body').attr('tmp_" + currVariable + "', " + currVariable + ");\n"
    }

    var script = document.createElement('script');
    script.id = 'tmpScript';
    script.appendChild(document.createTextNode(scriptContent));
    (document.body || document.head || document.documentElement).appendChild(script);

    for (var i = 0; i < variables.length; i++) {
        var currVariable = variables[i];
        ret[currVariable] = $("body").attr("tmp_" + currVariable);
        $("body").removeAttr("tmp_" + currVariable);
    }

    $("#tmpScript").remove();

    return ret;
}

function testInternalAPI() {
    dynavars = retrieveWindowVariables(["csrf_header_name","csrf_token"]);
    let myHeaders = new Headers();
    myHeaders.append(dynavars.csrf_header_name, dynavars.csrf_token);

    let myInit = { method: 'GET',
        headers: myHeaders,
        cache: 'default',
    }

    fetch('https://uqq74301.live.dynatrace.com/rest/services/SERVICE-CD507D2BDBDC5E4D', myInit)
    .then(function(response) {
        console.log(response.json())
    });
}

// Fired on page change and refresh
function onLoadAndHashChange() {    
    testInternalAPI();
    //Define a regex which checks if you're on a "problem details" screen or not
    problemCheck = new RegExp('(/#problems/problemdetails)').exec(window.location.href);
    if(problemCheck != null) {
        window.requestAnimationFrame(enhanceProblemDetails);
    }
};

// Adds listener to be able to modify from extension popup
chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
  if (request.action == 'modify') {
      colorizeTenant()
  }
  sendResponse({});
});

//Add window event listeners to trigger functions
window.addEventListener("load", onLoadAndHashChange, false);
window.addEventListener("load", colorizeTenant, false);
window.addEventListener("hashchange", onLoadAndHashChange, false);

