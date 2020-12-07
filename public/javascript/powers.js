console.log("i'm here")
function tester(something){
    console.log("YO, tester, IM HERE");
    console.log("THE something is ", something);
}

function deletePin(id){
    $(document).ready(function(){
        console.log("deleting time");

        $.ajax({
            method:   'GET',
            url:      '/leDelete/' + id,
            datatype: 'json',
            success: function(result){
                console.log("success ", result);

                $('#wholeItem'+id).hide();
                alert("Pin deleted");
            },
            error: function(error){
                console.log("error ", error);
                alert("Pin deletion failed");
            }
        });

    });
    
}

function updateDesc(id){
    $(document).ready(function(){
        console.log("updating description time");
        var desc = $("#textArea"+id).val();
        
        $.ajax({
            method:  'GET',
            url:     '/leUpdateDesc/' + id + '/'+ desc, // need to get a description
            datatype:'json',
            success: function(results){
                console.log("success", results);
                
                $("#description" + id).html("new desc: " + desc);
                alert("the description was updated");
            },
            error: function(error){
                console.log("error", error);
                
                alert("the description failed to update");
            }
        });
    });
}