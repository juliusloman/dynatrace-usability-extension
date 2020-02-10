//Define the query used to access the main browser window
let query = { active: true, currentWindow: true };

//Set the variable to be used to declare if we're on SaaS or Managed as well as the saas hostname in case you're using a non-live Dynatrace environment
let deploy;
let saasHost;

//Re-usable function for getting either the tenant ID or the Managed environment ID
function getTenantId(url, deploy) {
    //If the deployment is SaaS, then extract the tenant ID from the URL 
    if(deploy == "saas") {
        let saasTenant = new RegExp('([a-z]{3}[1234567890]{5})').exec(url);
        return saasTenant[0];
    }
    //If the deployment is Managed, extract the environment ID after "/e/" in the URL
    else if(deploy == "managed") {
        let managedTenant = new RegExp('(\/e\/)([^\/]*)').exec(url);
        return managedTenant[2];
    }
}

//When the popup is loaded, add a listener to the save button to save the options that have been input
document.addEventListener('DOMContentLoaded', function() {
let saveButton = document.getElementById('save');
    saveButton.addEventListener('click', function() {
        saveOptions(deploy);
    });
});
    
//Function to set the text box values when the popup is loaded
function setTextBoxDefaults(deploy) {
    
    //Function to extract the values stored in local storage
    function callback(tabs) {

        //Get either the SaaS tenant ID or the Managed environment ID from local storage
        let currentTab = tabs[0]; 
        tenant = getTenantId(currentTab.url, deploy); 
        console.log("retrieving values for " + tenant);

        //Using the ID above extract the values from local storage
        chrome.storage.local.get([tenant], function(result) {
            
            //If there are no values stored, then set the text fields to blank
            if(result[tenant] != undefined) {
                if (result[tenant].api_key == null && result[tenant].api_key == "") {
                    document.getElementById("api_key").value = "";
                } else {
                    document.getElementById("api_key").value = result[tenant].api_key;
                }

                if (result[tenant] == undefined && result[tenant].tag_filter_key == null) {
                    document.getElementById("tag_filter_key").value = ".*";
                } else {
                    document.getElementById("tag_filter_key").value = result[tenant].tag_filter_key;
                }

                if (result[tenant] == undefined && result[tenant].tenant_color == null) {
                    document.getElementById("tenant_color").value = "#000000";
                } else {
                    document.getElementById("tenant_color").value = result[tenant].tenant_color;
                }
            }
        });   
    }   
    
    //Query the local storage and start the functionality
    chrome.tabs.query(query, callback);
}

//Function for saving the values that have been set
function saveOptions(deploy) {
    function callback(tabs) {

        //Get either the SaaS tenant ID or the Managed environment ID from local storage
        let currentTab = tabs[0]; 
        tenant = getTenantId(currentTab.url, deploy); 

        console.log("saving values for " + tenant);
        //Take the API key and session properties from the text fields along with the conversion goals and put them into an object to be set in local storage
        let tenantInfo = {
            'api_key': document.getElementById("api_key").value,
            'tag_filter_key': document.getElementById("tag_filter_key").value,
            'tenant_color': document.getElementById("tenant_color").value
        }
        console.log(tenantInfo);

        //Push the object above into local storage, set to either the SaaS tenant ID or the Managed environment ID
        chrome.storage.local.set({[tenant]: tenantInfo}, function () {
            //Once it's been set, effectively "reload" by getting the conversion goals and text field values
            setTextBoxDefaults(deploy);
        });

        chrome.tabs.getSelected(null, function(tab) {
            chrome.tabs.sendRequest(tab.id, {action:'modify'}, function(response) {});
        });
    }

    chrome.tabs.query(query, callback);
}


//Function to check if you are on a Dynatrace environment
function checkIfDynatrace() {
    function callback(tabs) {
        //Get the URL from the main window
        let url = tabs[0].url; 
        
        //Use Regex to see if you're on a SaaS tenant or a Managed environment
        saasCheck = new RegExp('(\/\/[a-z]{3}[1234567890]{5}\.)').exec(url);
        managedCheck = new RegExp('(\/e\/[^\/]*)').exec(url);

        //If you're on a SaaS tenant, set the "deploy" to SaaS and extract the values from storage
        if(saasCheck != null) {
            function url_domain(data) {
                var    a      = document.createElement('a');
                       a.href = data;
                return a.hostname;
              }
              
            let saasRegex = new RegExp('([a-z]{3}[1234567890]{5}\.)(.*)').exec(url_domain(url));
    
            saasHost = saasRegex[2];

            deploy = "saas";
            setTextBoxDefaults(deploy);
        }
        //If you're on a Managed environment, set the "deploy" to Managed and extract the values from storage
        else if(managedCheck != null) {
            deploy = "managed";
            setTextBoxDefaults(deploy);
        }
        //otherwise, display a message asking the user to please visit a Dynatrace environment
        else {
            document.getElementById("content").style.display = "none";
            document.getElementById("no_content").style.display = "block";
        }
    }

    //Query the local storage to start the functionality
    chrome.tabs.query(query, callback);
}

//When the popup opens, start everything by checking if you're on a Dynatrace environment
$(document).ready(function() {
    checkIfDynatrace();
});