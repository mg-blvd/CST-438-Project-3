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